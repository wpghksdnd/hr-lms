import client from './client';
import type { CommonResponse, MypageResponse, CertificateResponse } from './types';

export async function getMypage(): Promise<MypageResponse> {
  const res = await client.get<CommonResponse<MypageResponse>>('/api/user/mypage');
  return res.data.data;
}

export async function getMyCertificates(): Promise<CertificateResponse[]> {
  const res = await client.get<CommonResponse<CertificateResponse[]>>('/api/user/certificates');
  return res.data.data;
}

export async function downloadCertificate(certificateId: number): Promise<void> {
  const res = await client.get(`/api/user/certificates/${certificateId}/download`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `이수증_${certificateId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
