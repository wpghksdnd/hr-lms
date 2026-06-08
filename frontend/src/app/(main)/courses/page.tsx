'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCourses, enrollCourse } from '@/api/courses';
import { cancelEnrollment } from '@/api/myLearning';
import type { CourseListItem } from '@/api/types';

const FILTERS = ['전체', '법정의무교육', '직무교육', '리더십', 'IT/디지털', '어학'];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: '수강 중',   className: 'bg-blue-50 text-blue-600' },
  DONE:        { label: '이수 완료', className: 'bg-emerald-50 text-emerald-600' },
  NOT_STARTED: { label: '승인 대기', className: 'bg-yellow-50 text-yellow-600' },
};

function getApiError(err: unknown): string {
  const resp = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return resp?.message ?? resp?.error ?? '';
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('전체');
  const [enrollingId, setEnrollingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  useEffect(() => {
    getCourses().then(setCourses).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = courses.filter((c) => {
    if (activeFilter !== '전체' && c.category !== activeFilter) return false;
    return !query || c.title.includes(query) || c.category.includes(query);
  });

  const handleEnroll = async (course: CourseListItem) => {
    if (!course.roundId) return;
    setEnrollingId(course.courseId);
    try {
      await enrollCourse(course.roundId);
      setCourses((prev) =>
        prev.map((c) => c.courseId === course.courseId ? { ...c, enrollmentStatus: 'IN_PROGRESS' } : c)
      );
    } catch (err: unknown) {
      alert(getApiError(err) || '수강 신청에 실패했습니다.');
    } finally {
      setEnrollingId(null);
    }
  };

  const handleCancel = async (course: CourseListItem) => {
    if (!course.enrollmentId) return;
    if (!confirm(`"${course.title}" 수강을 취소하시겠습니까?`)) return;
    setCancellingId(course.courseId);
    try {
      await cancelEnrollment(course.enrollmentId);
      setCourses((prev) =>
        prev.map((c) => c.courseId === course.courseId ? { ...c, enrollmentStatus: 'NOT_ENROLLED', enrollmentId: null } : c)
      );
    } catch (err: unknown) {
      alert(getApiError(err) || '수강 취소에 실패했습니다.');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-xs text-gray-400">불러오는 중...</div>;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-[#111]">개설 강좌 신청</h3>

      <input value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="강의명으로 검색하세요..."
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200" />

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              activeFilter === f ? 'bg-[#185FA5] text-white' : 'bg-white border border-gray-200 text-gray-700'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-xs text-gray-400 py-12">조건에 맞는 강좌가 없습니다.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c) => {
            const status = c.enrollmentStatus;
            const isEnrolled = status && status !== 'NOT_ENROLLED';
            const badge = status ? STATUS_BADGE[status] : null;
            const isCancelling = cancellingId === c.courseId;

            return (
              <div key={c.courseId} className="bg-white p-5 border border-black/[0.06] rounded-xl shadow-sm flex justify-between items-center gap-4">
                <div className="min-w-0">
                  <div className="font-bold text-[14px] text-[#222] mb-1 truncate">{c.title}</div>
                  <div className="text-xs text-[#777]">
                    {c.category}{c.durationMin ? ` · ${c.durationMin}분` : ''}
                  </div>
                  {c.endDate && (
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      수강 기간: {c.startDate} ~ {c.endDate}
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  {isEnrolled ? (
                    <>
                      {badge && (
                        <span className={`text-xs px-3 py-1.5 font-semibold rounded-lg ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                      {status === 'IN_PROGRESS' && (
                        <Link href={`/learning?courseId=${c.courseId}`}
                          className="text-[11px] text-[#185FA5] font-semibold hover:underline">
                          학습하기 →
                        </Link>
                      )}
                      {status === 'DONE' && (
                        <Link href="/mypage"
                          className="text-[11px] text-emerald-600 font-semibold hover:underline">
                          이수증 보기 →
                        </Link>
                      )}
                      {/* 수강 취소 — 이수 완료 강좌는 취소 불가 */}
                      {status !== 'DONE' && (
                        <button
                          onClick={() => handleCancel(c)}
                          disabled={isCancelling}
                          className="text-[10px] text-gray-400 hover:text-red-500 font-medium disabled:opacity-50 transition-colors">
                          {isCancelling ? '취소 중...' : '수강 취소'}
                        </button>
                      )}
                    </>
                  ) : c.roundId ? (
                    <button onClick={() => handleEnroll(c)} disabled={enrollingId === c.courseId}
                      className="text-xs px-3 py-2 font-semibold rounded-lg bg-[#185FA5] text-white hover:bg-[#144f8b] disabled:bg-gray-300 transition-colors">
                      {enrollingId === c.courseId ? '신청 중...' : '수강신청'}
                    </button>
                  ) : (
                    <span className="text-xs px-3 py-2 font-semibold rounded-lg bg-gray-100 text-gray-400">
                      개설 예정
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
