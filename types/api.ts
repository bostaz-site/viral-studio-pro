export interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
  message: string
}
