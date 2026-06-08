'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCalendar } from '@/api/calendar';
import type { CalendarItem } from '@/api/types';

const STATUS_STYLE: Record<string, { label: string; bar: string; badge: string }> = {
  IN_PROGRESS: { label: '수강 중',   bar: 'bg-[#185FA5]',    badge: 'bg-blue-50 text-blue-600' },
  DONE:        { label: '이수 완료', bar: 'bg-emerald-500',  badge: 'bg-emerald-50 text-emerald-600' },
  NOT_STARTED: { label: '수강 예정', bar: 'bg-yellow-400',   badge: 'bg-yellow-50 text-yellow-600' },
  NONE:        { label: '미수강',    bar: 'bg-gray-200',     badge: 'bg-gray-50 text-gray-400' },
};

function dday(endDate: string) {
  const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (diff < 0) return { label: '종료', className: 'text-gray-400' };
  if (diff === 0) return { label: 'D-day', className: 'text-red-500 font-black' };
  if (diff <= 7) return { label: `D-${diff}`, className: 'text-red-500 font-bold' };
  return { label: `D-${diff}`, className: 'text-gray-400' };
}

export default function CalendarPage() {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  useEffect(() => {
    getCalendar().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const displayed = filter === 'mine' ? items.filter((i) => i.enrollmentId) : items;

  // 상태별 카운트
  const counts = items.reduce<Record<string, number>>((acc, i) => {
    const s = i.myStatus ?? 'NONE';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center py-20 text-xs text-gray-400">불러오는 중...</div>;

  return (
    <div className="flex flex-col gap-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#111]">수강 캘린더</h1>
          <p className="text-xs text-gray-400 mt-0.5">개설된 강좌 일정과 나의 수강 현황을 확인하세요.</p>
        </div>
        {/* 요약 뱃지 */}
        <div className="flex gap-2">
          {Object.entries(STATUS_STYLE).filter(([k]) => counts[k]).map(([k, v]) => (
            <div key={k} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${v.badge}`}>
              {v.label} {counts[k]}
            </div>
          ))}
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        {(['all', 'mine'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-colors ${
              filter === f ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}>
            {f === 'all' ? '전체 강좌' : '내 수강 강좌'}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="bg-white border border-black/[0.06] rounded-xl p-12 text-center text-gray-400 text-sm">
          {filter === 'mine' ? '수강 중인 강좌가 없습니다.' : '개설된 강좌가 없습니다.'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayed.map((item) => {
            const status = item.myStatus ?? 'NONE';
            const style = STATUS_STYLE[status] ?? STATUS_STYLE.NONE;
            const dd = dday(item.endDate);
            const isEnrolled = !!item.enrollmentId;

            return (
              <div key={item.roundId}
                className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3 ${
                  status === 'IN_PROGRESS' ? 'border-blue-100' : status === 'DONE' ? 'border-emerald-100' : 'border-black/[0.06]'
                }`}>
                {/* 상단 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.badge}`}>{style.label}</span>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{item.category}</span>
                    </div>
                    <h3 className="text-sm font-bold text-[#111] mt-1">{item.courseTitle}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {item.roundNo && `${item.roundNo}차 · `}{item.startDate} ~ {item.endDate}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <span className={`text-xs ${dd.className}`}>{dd.label}</span>
                    {isEnrolled ? (
                      <Link href={`/learning?courseId=${item.courseId}`}
                        className="text-[11px] font-bold text-white bg-[#185FA5] hover:bg-[#144f8b] px-2.5 py-1 rounded-lg">
                        학습하기 →
                      </Link>
                    ) : (
                      <Link href="/courses"
                        className="text-[11px] font-bold text-[#185FA5] border border-[#185FA5] hover:bg-blue-50 px-2.5 py-1 rounded-lg">
                        수강신청
                      </Link>
                    )}
                  </div>
                </div>

                {/* 진도 바 */}
                {isEnrolled && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${style.bar}`}
                        style={{ width: `${item.myProgress ?? 0}%` }} />
                    </div>
                    <span className="text-[11px] font-semibold text-gray-500 w-8 text-right">
                      {item.myProgress ?? 0}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
