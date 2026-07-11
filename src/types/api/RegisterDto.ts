export interface RegisterRequestDto {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
}

export interface RegisterResponseDto {
  success: boolean;
  message: string;
}