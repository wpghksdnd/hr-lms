'use client';

interface PaginationProps {
  page: number;           // 현재 페이지 (0-based)
  totalPages: number;
  totalElements: number;
  size: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, totalElements, size, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = page * size + 1;
  const to   = Math.min((page + 1) * size, totalElements);

  // 페이지 번호 버튼: 현재 페이지 기준 앞뒤 2개씩 최대 5개
  const pages: number[] = [];
  const start = Math.max(0, page - 2);
  const end   = Math.min(totalPages - 1, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between px-1 py-2">
      <span className="text-xs text-gray-400">
        {from}–{to} / 총 {totalElements}건
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 0}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ‹
        </button>

        {start > 0 && (
          <>
            <button onClick={() => onChange(0)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">
              1
            </button>
            {start > 1 && <span className="text-xs text-gray-300 px-0.5">…</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
              p === page
                ? 'bg-[#1a1a2e] text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {p + 1}
          </button>
        ))}

        {end < totalPages - 1 && (
          <>
            {end < totalPages - 2 && <span className="text-xs text-gray-300 px-0.5">…</span>}
            <button onClick={() => onChange(totalPages - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages - 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ›
        </button>
      </div>
    </div>
  );
}
