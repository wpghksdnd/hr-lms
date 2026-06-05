import client from './client';
import type { CommonResponse, DashboardResponse } from './types';

export async function getDashboard(): Promise<DashboardResponse> {
  const res = await client.get<CommonResponse<DashboardResponse>>('/api/user/dashboard');
  return res.data.data;
}
