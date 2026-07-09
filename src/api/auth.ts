import api from './axios'
import type {
  RegisterRequestDto,
  RegisterResponseDto,
} from '@/types/api/RegisterDto'

type AuthApiResponse = {
  success?: boolean
  message?: string
  token?: string | null
}

export async function registerUser(payload: RegisterRequestDto) {
  const response = await api.post<RegisterResponseDto>('/register_user/', payload)
  return response.data
}

export async function loginUser(payload: { email: string }) {
  const response = await api.post<AuthApiResponse>('/login_user/', payload)
  return response.data
}

export async function verifyEmail(payload: { email: string; otp: string }) {
  const response = await api.post<AuthApiResponse>('/verify_email/', payload)
  return response.data
}