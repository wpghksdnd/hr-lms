'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCourses, enrollCourse } from '@/api/courses';
import { cancelEnrollment } from '@/api/myLearning';
import type { CourseListItem } from '@/api/types';

const FILTERS = ['전체', '법정의무교육', '직무교육', '리더십', 'IT/디지털', '어학'];

/* 카테고리별 썸네일 스타일 */
const CATEGORY_THEME: Record<string, {
  gradient: string; emoji: string; badge: string;
}> = {
  '법정의무교육': {
    gradient: 'from-blue-600 to-blue-400',
    emoji: '⚖️',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  '직무교육': {
    gradient: 'from-violet-600 to-purple-400',
    emoji: '💼',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  '리더십': {
    gradient: 'from-amber-500 to-orange-400',
    emoji: '🏆',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  'IT/디지털': {
    gradient: 'from-teal-600 to-cyan-400',
    emoji: '💻',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  '어학': {
    gradient: 'from-rose-500 to-pink-400',
    emoji: '🌐',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

const DEFAULT_THEME = {
  gradient: 'from-slate-600 to-slate-400',
  emoji: '📚',
  badge: 'bg-slate-50 text-slate-700 border-slate-200',
};

function getTheme(category: string) {
  return CATEGORY_THEME[category] ?? DEFAULT_THEME;
}

function formatDuration(min?: number | null) {
  if (!min) return null;
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin text-blue-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span className="text-xs text-slate-400">강좌 목록을 불러오는 중...</span>
        </div>
      </div>
    );
  }

  const enrolledCount = courses.filter((c) => c.enrollmentStatus && c.enrollmentStatus !== 'NOT_ENROLLED').length;
  const doneCount = courses.filter((c) => c.enrollmentStatus === 'DONE').length;

  return (
    <div className="flex flex-col gap-6">

      {/* ── 페이지 헤더 ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">강좌 카탈로그</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            총 <span className="font-bold text-slate-600">{courses.length}개</span> 강좌
            {enrolledCount > 0 && (
              <> · 수강 중 <span className="font-bold text-blue-600">{enrolledCount}개</span></>
            )}
            {doneCount > 0 && (
              <> · 이수 완료 <span className="font-bold text-emerald-600">{doneCount}개</span></>
            )}
          </p>
        </div>

        {/* 검색 */}
        <div className="relative w-full sm:w-72">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="강의명으로 검색..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10 transition-all shadow-sm" />
        </div>
      </div>

      {/* ── 필터 탭 ── */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150 ${
              activeFilter === f
                ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm shadow-blue-500/20'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}>
            {f}
            {f !== '전체' && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeFilter === f ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {courses.filter(c => c.category === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 강좌 그리드 ── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-sm font-semibold text-slate-500 mb-1">검색 결과가 없습니다</p>
          <p className="text-xs text-slate-400">다른 키워드나 카테고리로 검색해 보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((c) => {
            const status = c.enrollmentStatus;
            const isEnrolled = status && status !== 'NOT_ENROLLED';
            const isDone = status === 'DONE';
            const isInProgress = status === 'IN_PROGRESS';
            const isPending = status === 'NOT_STARTED';
            const isCancelling = cancellingId === c.courseId;
            const isEnrolling = enrollingId === c.courseId;
            const theme = getTheme(c.category);
            const duration = formatDuration(c.durationMin);

            return (
              <div key={c.courseId}
                className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col">

                {/* 썸네일 */}
                <div className={`relative h-36 bg-gradient-to-br ${theme.gradient} flex items-center justify-center overflow-hidden`}>
                  {/* 배경 패턴 */}
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                  <div className="absolute top-3 right-3">
                    {isDone && (
                      <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        이수 완료
                      </span>
                    )}
                    {isInProgress && (
                      <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                        수강 중
                      </span>
                    )}
                    {isPending && (
                      <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                        ⏳ 승인 대기
                      </span>
                    )}
                  </div>
                  <span className="text-5xl drop-shadow-md">{theme.emoji}</span>
                </div>

                {/* 카드 본문 */}
                <div className="flex flex-col flex-1 p-4 gap-3">
                  {/* 카테고리 + 시간 */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${theme.badge}`}>
                      {c.category}
                    </span>
                    {duration && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {duration}
                      </span>
                    )}
                  </div>

                  {/* 제목 */}
                  <h3 className="text-sm font-bold text-slate-800 leading-snug line-clamp-2 flex-1 group-hover:text-blue-600 transition-colors">
                    {c.title}
                  </h3>

                  {/* 수강 기간 */}
                  {c.startDate && c.endDate && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <span>{c.startDate} ~ {c.endDate}</span>
                    </div>
                  )}

                  {/* 구분선 */}
                  <div className="border-t border-slate-100" />

                  {/* 액션 버튼 */}
                  <div className="flex items-center justify-between gap-2">
                    {isEnrolled ? (
                      <>
                        <div className="flex items-center gap-2">
                          {isDone && (
                            <Link href="/mypage"
                              className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold hover:underline">
                              🏅 이수증 보기
                            </Link>
                          )}
                          {isInProgress && (
                            <Link href={`/learning?courseId=${c.courseId}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                              학습 이어하기
                            </Link>
                          )}
                          {isPending && (
                            <span className="text-[11px] text-amber-600 font-bold">
                              승인 대기 중
                            </span>
                          )}
                        </div>
                        {!isDone && (
                          <button onClick={() => handleCancel(c)} disabled={isCancelling}
                            className="text-[10px] text-slate-400 hover:text-red-500 font-medium disabled:opacity-50 transition-colors underline-offset-2 hover:underline">
                            {isCancelling ? '취소 중...' : '수강 취소'}
                          </button>
                        )}
                      </>
                    ) : c.roundId ? (
                      <button onClick={() => handleEnroll(c)} disabled={isEnrolling}
                        className="w-full py-2 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-blue-500/20 hover:shadow-md active:scale-[0.98]">
                        {isEnrolling ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                            신청 중...
                          </span>
                        ) : '수강 신청하기'}
                      </button>
                    ) : (
                      <div className="w-full py-2 bg-slate-50 text-slate-400 text-xs font-semibold rounded-xl text-center border border-slate-100">
                        개설 예정
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
