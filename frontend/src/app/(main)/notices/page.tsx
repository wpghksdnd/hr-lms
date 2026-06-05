'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getNotices } from '@/api/notices';
import type { NoticeListItem, Page } from '@/api/types';

function fmtDate(str: string) {
  return str ? str.slice(0, 10) : '';
}

export default function NoticesPage() {
  const [data, setData] = useState<Page<NoticeListItem> | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getNotices(page, 10)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-black/[0.06] rounded-xl p-5 shadow-sm">
        <h2 className="text-xl font-bold text-[#111] mb-0.5">📢 공지사항</h2>
        <p className="text-xs text-[#666]">회사 및 교육 관련 공지사항을 확인하세요.</p>
      </div>

      <div className="bg-white border border-black/[0.06] rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-xs text-gray-400">불러오는 중...</div>
        ) : (data?.content ?? []).length === 0 ? (
          <div className="flex items-center justify-center py-20 text-xs text-gray-400">등록된 공지사항이 없습니다.</div>
        ) : (
          <ul className="divide-y divide-black/[0.05]">
            {(data?.content ?? []).map((notice, idx) => (
              <li key={notice.noticeId}>
                <Link href={`/notices/${notice.noticeId}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group">
                  <span className="text-xs text-gray-300 w-6 text-right shrink-0">
                    {(page * 10) + idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {notice.isPinned && (
                        <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded shrink-0">필독</span>
                      )}
                      <span className="text-sm font-medium text-[#222] group-hover:text-[#185FA5] transition-colors truncate">
                        {notice.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">{notice.contentPreview}</p>
                  </div>
                  <div className="text-[11px] text-gray-400 shrink-0 text-right">
                    <div>{fmtDate(notice.createdAt)}</div>
                    <div className="mt-0.5">조회 {notice.viewCount ?? 0}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* 페이지네이션 */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-5 py-4 border-t border-black/[0.05]">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-xs rounded-lg border border-black/[0.08] text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              이전
            </button>
            {Array.from({ length: data.totalPages }, (_, i) => (
              <button key={i}
                onClick={() => setPage(i)}
                className={`w-8 h-8 text-xs rounded-lg border transition-colors ${
                  i === page
                    ? 'bg-[#185FA5] text-white border-[#185FA5] font-bold'
                    : 'border-black/[0.08] text-gray-500 hover:bg-gray-50'
                }`}>
                {i + 1}
              </button>
            ))}
            <button
              disabled={data.last}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-xs rounded-lg border border-black/[0.08] text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
