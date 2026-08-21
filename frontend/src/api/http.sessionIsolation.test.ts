import { beforeEach, describe, expect, it, vi } from "vitest";

const axiosMocks = vi.hoisted(() => ({
  isAxiosError: vi.fn(() => false),
  post: vi.fn(),
  request: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      request: axiosMocks.request,
    })),
    isAxiosError: axiosMocks.isAxiosError,
    post: axiosMocks.post,
  },
}));

import { ApiClientError } from "./errors";
import { api, configureAuthAccessors } from "./http";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function unauthorized() {
  return new ApiClientError({
    code: "TOKEN_NOT_VALID",
    message: "Token is invalid or expired.",
    details: {},
    status: 401,
  });
}

describe("HTTP authentication-session isolation", () => {
  let state: {
    accessToken: string | null;
    refreshToken: string | null;
    revision: number;
  };
  let clearCalls: number;
  let clearReasons: Array<"SESSION_REVOKED" | undefined>;

  beforeEach(() => {
    axiosMocks.post.mockReset();
    axiosMocks.request.mockReset();
    clearCalls = 0;
    clearReasons = [];
    state = {
      accessToken: "access-A",
      refreshToken: "refresh-A",
      revision: 1,
    };
    configureAuthAccessors({
      clearAuth: (reason) => {
        clearCalls += 1;
        clearReasons.push(reason);
        state = { accessToken: null, refreshToken: null, revision: state.revision + 1 };
      },
      getAccessToken: () => state.accessToken,
      getRefreshToken: () => state.refreshToken,
      getSessionRevision: () => state.revision,
      setAccessToken: (accessToken) => {
        state.accessToken = accessToken;
      },
    });
  });

  it("does not install or clear B when A's delayed refresh settles", async () => {
    const delayedRefresh = deferred<{ data: { access: string } }>();
    axiosMocks.request.mockRejectedValueOnce(unauthorized());
    axiosMocks.post.mockReturnValueOnce(delayedRefresh.promise);

    const pendingARequest = api.get("/patients/");
    await vi.waitFor(() => expect(axiosMocks.post).toHaveBeenCalledTimes(1));

    state = { accessToken: "access-B", refreshToken: "refresh-B", revision: 2 };
    delayedRefresh.resolve({ data: { access: "late-access-A" } });

    await expect(pendingARequest).rejects.toMatchObject({
      code: "AUTH_SESSION_CHANGED",
    });
    expect(state).toEqual({
      accessToken: "access-B",
      refreshToken: "refresh-B",
      revision: 2,
    });
    expect(clearCalls).toBe(0);
    expect(axiosMocks.request).toHaveBeenCalledTimes(1);
  });

  it("does not clear B when A's delayed refresh fails", async () => {
    const delayedRefresh = deferred<{ data: { access: string } }>();
    axiosMocks.request.mockRejectedValueOnce(unauthorized());
    axiosMocks.post.mockReturnValueOnce(delayedRefresh.promise);

    const pendingARequest = api.get("/appointments/");
    await vi.waitFor(() => expect(axiosMocks.post).toHaveBeenCalledTimes(1));

    state = { accessToken: "access-B", refreshToken: "refresh-B", revision: 2 };
    delayedRefresh.reject(new Error("late A refresh failed"));

    await expect(pendingARequest).rejects.toThrow("late A refresh failed");
    expect(state).toEqual({
      accessToken: "access-B",
      refreshToken: "refresh-B",
      revision: 2,
    });
    expect(clearCalls).toBe(0);
  });

  it("does not refresh B or retry an A request whose 401 arrives after the switch", async () => {
    const delayedRequest = deferred<never>();
    axiosMocks.request.mockReturnValueOnce(delayedRequest.promise);

    const pendingARequest = api.post("/visits/77/complete/", { notes: "A mutation" });
    state = { accessToken: "access-B", refreshToken: "refresh-B", revision: 2 };
    delayedRequest.reject(unauthorized());

    await expect(pendingARequest).rejects.toMatchObject({ code: "TOKEN_NOT_VALID" });
    expect(axiosMocks.post).not.toHaveBeenCalled();
    expect(axiosMocks.request).toHaveBeenCalledTimes(1);
    expect(state.accessToken).toBe("access-B");
  });

  it("starts B's own refresh instead of sharing A's pending refresh promise", async () => {
    const delayedARefresh = deferred<{ data: { access: string } }>();
    const delayedBRefresh = deferred<{ data: { access: string } }>();
    axiosMocks.request
      .mockRejectedValueOnce(unauthorized())
      .mockRejectedValueOnce(unauthorized())
      .mockResolvedValueOnce({ data: { owner: "B" } });
    axiosMocks.post
      .mockReturnValueOnce(delayedARefresh.promise)
      .mockReturnValueOnce(delayedBRefresh.promise);

    const pendingARequest = api.get("/dashboard/doctor/");
    await vi.waitFor(() => expect(axiosMocks.post).toHaveBeenCalledTimes(1));

    state = { accessToken: "access-B", refreshToken: "refresh-B", revision: 2 };
    const pendingBRequest = api.get<{ owner: string }>("/dashboard/doctor/");
    await vi.waitFor(() => expect(axiosMocks.post).toHaveBeenCalledTimes(2));
    expect(axiosMocks.post.mock.calls[1]?.[1]).toEqual({ refresh: "refresh-B" });

    delayedBRefresh.resolve({ data: { access: "replacement-access-B" } });
    await expect(pendingBRequest).resolves.toEqual({ owner: "B" });
    expect(state.accessToken).toBe("replacement-access-B");

    delayedARefresh.resolve({ data: { access: "late-access-A" } });
    await expect(pendingARequest).rejects.toMatchObject({
      code: "AUTH_SESSION_CHANGED",
    });
    expect(state.accessToken).toBe("replacement-access-B");
    expect(clearCalls).toBe(0);
  });

  it("marks a terminal 401 refresh failure as a revoked session", async () => {
    axiosMocks.request.mockRejectedValueOnce(unauthorized());
    axiosMocks.post.mockRejectedValueOnce(unauthorized());

    await expect(api.get("/patients/")).rejects.toMatchObject({ status: 401 });

    expect(clearCalls).toBe(1);
    expect(clearReasons).toEqual(["SESSION_REVOKED"]);
    expect(state).toEqual({ accessToken: null, refreshToken: null, revision: 2 });
  });

  it("clears a current session when the post-refresh retry is also rejected", async () => {
    axiosMocks.request
      .mockRejectedValueOnce(unauthorized())
      .mockRejectedValueOnce(unauthorized());
    axiosMocks.post.mockResolvedValueOnce({ data: { access: "replacement-access-A" } });

    await expect(api.get("/dashboard/doctor/")).rejects.toMatchObject({ status: 401 });

    expect(clearReasons).toEqual(["SESSION_REVOKED"]);
    expect(state).toEqual({ accessToken: null, refreshToken: null, revision: 2 });
  });

  it("does not clear B when A's delayed post-refresh retry is rejected", async () => {
    const delayedRetry = deferred<never>();
    axiosMocks.request
      .mockRejectedValueOnce(unauthorized())
      .mockReturnValueOnce(delayedRetry.promise);
    axiosMocks.post.mockResolvedValueOnce({ data: { access: "replacement-access-A" } });

    const pendingARequest = api.get("/dashboard/doctor/");
    await vi.waitFor(() => expect(axiosMocks.request).toHaveBeenCalledTimes(2));

    state = { accessToken: "access-B", refreshToken: "refresh-B", revision: 2 };
    delayedRetry.reject(unauthorized());

    await expect(pendingARequest).rejects.toMatchObject({ status: 401 });
    expect(clearCalls).toBe(0);
    expect(state).toEqual({
      accessToken: "access-B",
      refreshToken: "refresh-B",
      revision: 2,
    });
  });
});
