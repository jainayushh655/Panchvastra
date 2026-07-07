export interface RegisterRequestDto {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
}

export interface RegisterResponseDto {
  status: boolean;
  message: string;
  data: string;
}