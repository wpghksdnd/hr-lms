'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getNoticeDetail } from '@/api/notices';
import type { NoticeDetail } from '@/api/types';

function fmtDate(str: string) {
  return str ? str.slice(0, 16).replace('T', ' ') : '';
}

export default function NoticeDetailPage() {
  const params = useParams();
  const noticeId = Number(params.noticeId);
  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!noticeId) return;
    setLoading(true);
    getNoticeDetail(noticeId)
      .then(setNotice)
      .catch(() => setError('공지사항을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [noticeId]);

  if (loading) return <div className="flex items-center justify-center py-20 text-xs text-gray-400">불러오는 중...</div>;
  if (error || !notice) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="text-gray-400 text-sm">{error || '공지사항을 찾을 수 없습니다.'}</div>
      <Link href="/notices" className="text-xs text-[#185FA5] font-semibold">← 목록으로 돌아가기</Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <Link href="/notices" className="text-xs text-gray-400 hover:text-[#185FA5] transition-colors">📢 공지사항</Link>
        <span className="text-gray-300 text-xs">›</span>
        <span className="text-xs text-gray-500 truncate">{notice.title}</span>
      </div>

      <div className="bg-white border border-black/[0.06] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-black/[0.06]">
          <div className="flex items-start gap-2 mb-2">
            {notice.isPinned && (
              <span className="shrink-0 text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded mt-0.5">필독</span>
            )}
            <h1 className="text-lg font-bold text-[#111] leading-snug">{notice.title}</h1>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-400">
            <span>등록일 {fmtDate(notice.createdAt)}</span>
            {notice.updatedAt && notice.updatedAt !== notice.createdAt && (
              <span>수정일 {fmtDate(notice.updatedAt)}</span>
            )}
            <span>조회 {notice.viewCount ?? 0}</span>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="text-sm text-[#333] leading-relaxed whitespace-pre-wrap">{notice.content}</div>
        </div>
      </div>

      <div className="flex justify-center">
        <Link href="/notices"
          className="px-5 py-2 bg-white border border-black/[0.08] text-xs font-semibold text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
          ← 목록으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
