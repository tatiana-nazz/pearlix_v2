import { describe, expect, it, vi } from "vitest";

import { getAllPages } from "./pagination";

describe("bounded complete pagination", () => {
  it.each([21, 50, 105])("retrieves page-two and later records for %s-row histories", async (count) => {
    const rows = Array.from({ length: count }, (_, index) => index + 1);
    const fetchPage = vi.fn(async (page: number) => {
      const start = (page - 1) * 20;
      const results = rows.slice(start, start + 20);
      return {
        count,
        previous: page > 1 ? `?page=${page - 1}` : null,
        next: start + 20 < count ? `?page=${page + 1}` : null,
        results,
      };
    });
    const result = await getAllPages(fetchPage);
    expect(result.results).toEqual(rows);
    expect(result.count).toBe(count);
    expect(fetchPage).toHaveBeenCalledTimes(Math.ceil(count / 20));
  });
});
