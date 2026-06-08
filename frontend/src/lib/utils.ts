// ─── API 에러 메시지 추출 ─────────────────────────────────────────────────────
export function getApiError(err: unknown): string {
  const resp = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return resp?.message ?? resp?.error ?? '';
}

// ─── Blob 다운로드 ────────────────────────────────────────────────────────────
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── 수강 상태 라벨 / 색상 ────────────────────────────────────────────────────
export const ENROLLMENT_STATUS: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: '수강 중',   className: 'bg-blue-50 text-blue-600' },
  DONE:        { label: '이수 완료', className: 'bg-emerald-50 text-emerald-600' },
  NOT_STARTED: { label: '승인 대기', className: 'bg-yellow-50 text-yellow-600' },
  NOT_ENROLLED:{ label: '미신청',    className: 'bg-gray-50 text-gray-400' },
};

// ─── 초 → mm:ss 포맷 (분/초 모두 zero-pad) ───────────────────────────────────
export function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
