'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDashboard } from '@/api/dashboard';
import type { DashboardResponse } from '@/api/types';

const STAT_CARDS = (d: DashboardResponse | null) => [
  {
    label: '수강 중',
    value: d?.currentCoursesCount ?? 0,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" />
      </svg>
    ),
    iconBg: 'bg-blue-100 text-blue-600',
    valueCls: 'text-blue-700',
    borderCls: 'border-t-blue-500',
    href: undefined,
  },
  {
    label: '수료 완료',
    value: d?.completedCoursesCount ?? 0,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    iconBg: 'bg-emerald-100 text-emerald-600',
    valueCls: 'text-emerald-700',
    borderCls: 'border-t-emerald-500',
    href: undefined,
  },
  {
    label: '전체 이수율',
    value: `${Math.round(d?.overallCompletionRate ?? 0)}%`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    iconBg: 'bg-indigo-100 text-indigo-600',
    valueCls: 'text-indigo-700',
    borderCls: 'border-t-indigo-500',
    href: undefined,
  },
  {
    label: '미확인 알림',
    value: d?.unreadNotificationsCount ?? 0,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    iconBg: 'bg-amber-100 text-amber-600',
    valueCls: 'text-amber-700',
    borderCls: 'border-t-amber-500',
    href: '/notifications',
  },
];

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard().then(setDashboard).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin text-blue-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span className="text-xs text-slate-400">불러오는 중...</span>
        </div>
      </div>
    );
  }

  const completionRate = Math.round(dashboard?.overallCompletionRate ?? 0);

  return (
    <div className="flex flex-col gap-5">

      {/* ── 히어로 배너 ── */}
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 shadow-md"
        style={{ background: 'linear-gradient(135deg, #1E40AF 0%, #2563EB 60%, #3B82F6 100%)' }}>
        {/* 장식 */}
        <div className="absolute right-0 top-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute right-16 bottom-0 w-28 h-28 bg-white/5 rounded-full translate-y-1/2 pointer-events-none" />
        <div className="absolute left-1/2 bottom-0 w-96 h-20 bg-white/[0.03] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <p className="text-blue-200 text-sm font-medium mb-1 flex items-center gap-1.5">
              <span>👋</span> 안녕하세요
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {dashboard?.userName ?? '사원'}님, 오늘도 화이팅!
            </h2>
            <p className="text-blue-100/80 text-sm mt-2 leading-relaxed">
              진행 중인 필수 교육과 학습 현황을 실시간으로 확인하세요.
            </p>
          </div>

          {/* 이수율 미니 차트 */}
          <div className="sm:shrink-0 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 flex flex-col items-center min-w-[120px]">
            <span className="text-3xl font-black text-white">{completionRate}%</span>
            <span className="text-blue-200 text-xs mt-0.5 font-medium">전체 이수율</span>
            <div className="w-full h-1.5 bg-white/20 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-700"
                style={{ width: `${completionRate}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 스탯 카드 4개 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CARDS(dashboard).map((item) => {
          const card = (
            <div className={`bg-white rounded-2xl border-t-[3px] ${item.borderCls} border-x-0 border-b-0 shadow-sm p-4 flex items-center gap-3.5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}>
              <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0`}>
                {item.icon}
              </div>
              <div>
                <div className={`text-2xl font-black ${item.valueCls}`}>{item.value}</div>
                <div className="text-[11px] text-slate-400 font-medium mt-0.5">{item.label}</div>
              </div>
            </div>
          );
          return item.href ? (
            <Link key={item.label} href={item.href}>{card}</Link>
          ) : (
            <div key={item.label}>{card}</div>
          );
        })}
      </div>

      {/* ── 하단 2컬럼 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* 수강 중인 강좌 */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded-full block" />
              수강 중인 강좌
            </h3>
            <Link href="/courses" className="text-[11px] text-blue-600 font-semibold hover:underline">전체보기 →</Link>
          </div>

          {(dashboard?.inProgressCourses ?? []).length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-500 mb-1">수강 중인 강좌가 없습니다</p>
              <p className="text-xs text-slate-400 mb-3">원하는 교육을 신청해 학습을 시작해 보세요.</p>
              <Link href="/courses"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                수강신청 하러 가기
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
              </Link>
            </div>
          ) : (
            (dashboard?.inProgressCourses ?? []).map((course) => (
              <div key={course.courseId} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-all duration-200">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-xl shrink-0">
                    📋
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[14px] text-slate-800 mb-0.5 truncate">{course.title}</div>
                    {course.deadline && (
                      <p className="text-[11px] text-amber-500 font-medium mb-2 flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {course.deadline}까지
                      </p>
                    )}
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 max-w-[140px] bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${course.progress}%` }} />
                      </div>
                      <span className="text-[11px] text-blue-600 font-bold">{course.progress}%</span>
                    </div>
                  </div>
                </div>
                <Link href={`/learning?courseId=${course.courseId}`}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-blue-500/25 hover:shadow-md transition-all active:scale-[0.97]">
                  이어보기
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14m-7-7 7 7-7 7"/>
                  </svg>
                </Link>
              </div>
            ))
          )}
        </div>

        {/* 우측 패널 */}
        <div className="flex flex-col gap-4">

          {/* 공지사항 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <span className="text-base">📢</span> 공지사항
              </h4>
              <Link href="/notices" className="text-[11px] text-blue-600 font-semibold hover:underline">전체보기 →</Link>
            </div>
            {(dashboard?.recentNotices ?? []).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">등록된 공지사항이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {(dashboard?.recentNotices ?? []).map((notice) => (
                  <li key={notice.noticeId}>
                    <Link href={`/notices/${notice.noticeId}`}
                      className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-slate-50 transition-colors group">
                      {notice.isPinned && (
                        <span className="shrink-0 text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-md">필독</span>
                      )}
                      <span className="text-xs text-slate-600 group-hover:text-blue-600 transition-colors line-clamp-1 font-medium">
                        {notice.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* AI 학습 헬퍼 */}
          <div className="relative overflow-hidden rounded-2xl shadow-sm border border-slate-100 p-4"
            style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)' }}>
            <div className="absolute right-0 top-0 w-24 h-24 bg-blue-400/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/30 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-white">AI 학습 도우미</h4>
              </div>
              <p className="text-[11px] text-blue-200/80 leading-relaxed mb-3">
                강의 내용이 헷갈리거나<br />사내 규정이 궁금할 때 물어보세요.
              </p>
              <Link href="/chatbot"
                className="block w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs rounded-xl text-center transition-colors">
                AI 챗봇 열기 →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
