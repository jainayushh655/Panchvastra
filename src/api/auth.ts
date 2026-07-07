import api from "./axios";
import type {
  RegisterRequestDto,
  RegisterResponseDto,
} from "@/types/api/RegisterDto";

export async function registerUser(
  payload: RegisterRequestDto
) {
  const response = await api.post<RegisterResponseDto>(
    "/register_user/",
    payload
  );

  return response.data;
}