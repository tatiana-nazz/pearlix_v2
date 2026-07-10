export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown>;
  status: number;
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface Timestamped {
  created_at: string;
  updated_at: string;
}
