import { QueryClient } from "@tanstack/react-query";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  });
}

type QueryClientSession = {
  client: QueryClient;
  generation: number;
};

export let queryClient = createQueryClient();

let session: QueryClientSession = { client: queryClient, generation: 0 };
const listeners = new Set<() => void>();

export function getQueryClientSession() {
  return session;
}

export function subscribeToQueryClientSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function rotateAuthenticatedQueryClient() {
  const retiredClient = queryClient;
  queryClient = createQueryClient();
  session = {
    client: queryClient,
    generation: session.generation + 1,
  };
  retiredClient.clear();
  listeners.forEach((listener) => listener());
}
