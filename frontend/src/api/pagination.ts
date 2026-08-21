import type { Page } from "../types/api";

export const MAX_ALL_PAGE_REQUESTS = 100;
export const MAX_ALL_PAGE_RECORDS = 2_000;

export async function getAllPages<T>(fetchPage: (page: number) => Promise<Page<T>>): Promise<Page<T>> {
  const results: T[] = [];
  let pageNumber = 1;
  let count = 0;
  while (pageNumber <= MAX_ALL_PAGE_REQUESTS) {
    const page = await fetchPage(pageNumber);
    count = page.count;
    results.push(...page.results);
    if (!page.next || results.length >= page.count) {
      return { count, next: null, previous: null, results };
    }
    if (results.length >= MAX_ALL_PAGE_RECORDS) {
      throw new Error("The complete result set exceeds the safe client retrieval limit.");
    }
    pageNumber += 1;
  }
  throw new Error("The complete result set exceeds the safe page retrieval limit.");
}
