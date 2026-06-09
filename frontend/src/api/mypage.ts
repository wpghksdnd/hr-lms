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
  try {
    const res = await client.get(`/api/user/certificates/${certificateId}/download`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `이수증_${certificateId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    alert('이수증 파일을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.');
  }
}
