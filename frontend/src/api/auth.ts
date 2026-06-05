import client from './client';

export interface LoginRequest {
  employeeNo: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  name: string;
  role: string; // "ADMIN" | "FIELD" | "OFFICE"
  passwordChanged: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await client.post<LoginResponse>('/api/auth/login', data);
  return res.data;
}

export async function changePassword(data: ChangePasswordRequest): Promise<void> {
  await client.put('/api/auth/password', data);
}
