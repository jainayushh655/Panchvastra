export interface ApiResponse<T> {
  status: boolean
  message?: string
  data: T | null
  error?: string | null
}

export interface AuthSessionData {
  token: string | null
}
