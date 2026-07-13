export interface ApiResponse<T> {
  traceId: string;
  data: T;
}

export interface AppError {
  code: string;
  message: string;
  details?: unknown[];
}
