'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDashboard } from '@/api/dashboard';
import type { DashboardResponse } from '@/api/types';

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard().then(setDashboard).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-xs text-gray-400">불러오는 중...</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-black/[0.06] rounded-xl p-5 shadow-sm">
        <h2 className="text-xl font-bold text-[#111] mb-1">안녕하세요, {dashboard?.userName ?? '사원'}님 👋</h2>
        <p className="text-xs text-[#666]">진행 중인 필수 교육과 학습 현황을 실시간으로 안내해 드립니다.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: '수강 중', value: dashboard?.currentCoursesCount ?? 0, color: 'text-[#185FA5]' },
          { label: '수료 완료', value: dashboard?.completedCoursesCount ?? 0, color: 'text-emerald-600' },
          { label: '전체 이수율', value: `${Math.round(dashboard?.overallCompletionRate ?? 0)}%`, color: 'text-[#185FA5]' },
          { label: '미확인 알림', value: dashboard?.unreadNotificationsCount ?? 0, color: 'text-red-500', href: '/notifications', icon: '🔔' },
        ].map((item) => {
          const content = item.icon ? (
            <div className="flex items-center justify-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-2xl shadow-inner ring-1 ring-amber-100">
                {item.icon}
              </span>
              <span className="text-left">
                <span className={`block text-xl font-black ${item.color}`}>({item.value})</span>
                <span className="block text-[11px] text-gray-400 mt-0.5">{item.label}</span>
              </span>
            </div>
          ) : (
            <>
              <div className={`text-2xl font-black ${item.color}`}>{item.value}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{item.label}</div>
            </>
          );

          return item.href ? (
            <Link key={item.label} href={item.href} className="bg-white border border-black/[0.06] rounded-xl p-4 text-center shadow-sm transition-colors hover:bg-gray-50">
              {content}
            </Link>
          ) : (
            <div key={item.label} className="bg-white border border-black/[0.06] rounded-xl p-4 text-center shadow-sm">
              {content}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-[#444] px-1">수강 중인 강좌</h3>
          {(dashboard?.inProgressCourses ?? []).length === 0 ? (
            <div className="bg-white border border-black/[0.06] rounded-xl p-6 text-center text-xs text-gray-400 shadow-sm">
              수강 중인 강좌가 없습니다.{' '}
              <Link href="/courses" className="text-[#185FA5] font-semibold">수강신청 하러 가기 →</Link>
            </div>
          ) : (
            (dashboard?.inProgressCourses ?? []).map((course) => (
              <div key={course.courseId} className="bg-white border border-black/[0.06] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FCEBEB] flex items-center justify-center text-lg mt-0.5 shrink-0">📋</div>
                  <div>
                    <div className="font-semibold text-[14px] mb-0.5">{course.title}</div>
                    {course.deadline && <p className="text-xs text-[#888] mb-2">수강기한 {course.deadline}까지</p>}
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#185FA5] h-full" style={{ width: `${course.progress}%` }} />
                      </div>
                      <span className="text-[11px] text-[#185FA5] font-semibold">{course.progress}% 진행됨</span>
                    </div>
                  </div>
                </div>
                <Link href={`/learning?courseId=${course.courseId}`} className="px-4 py-2 bg-[#185FA5] hover:bg-[#144f8b] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors">
                  강의 이어보기 ›
                </Link>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* 공지사항 */}
          <div className="bg-white border border-black/[0.06] rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-[#333] flex items-center gap-1.5"><span>📢</span> 공지사항</h4>
              <Link href="/notices" className="text-[11px] text-[#185FA5] font-semibold hover:underline">전체보기 →</Link>
            </div>
            {(dashboard?.recentNotices ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">등록된 공지사항이 없습니다.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-gray-50">
                {(dashboard?.recentNotices ?? []).map((notice) => (
                  <li key={notice.noticeId}>
                    <Link href={`/notices/${notice.noticeId}`}
                      className="flex items-start gap-2 py-2.5 hover:bg-gray-50 rounded-lg px-1 transition-colors group">
                      {notice.isPinned && (
                        <span className="shrink-0 mt-0.5 text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">필독</span>
                      )}
                      <span className="text-xs text-[#333] group-hover:text-[#185FA5] transition-colors line-clamp-1 font-medium">
                        {notice.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* AI 학습 헬퍼 */}
          <div className="bg-white border border-black/[0.06] rounded-xl p-4 shadow-sm">
            <h4 className="font-bold text-[#333] mb-1.5 flex items-center gap-1.5"><span>💬</span> AI 학습 헬퍼</h4>
            <p className="text-xs text-[#666] mb-3 leading-relaxed">강의 내용 중 헷갈리는 내용이나 사내 법규 규정은 챗봇에게 문의하세요.</p>
            <Link href="/chatbot" className="block w-full py-2 bg-gray-50 hover:bg-gray-100 text-[#185FA5] font-semibold text-xs border border-black/[0.08] rounded-lg transition-colors text-center">
              AI 챗봇 연결
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
