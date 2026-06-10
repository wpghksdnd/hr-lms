'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdminDashboard, AdminDashboardResponse } from '@/api/adminApi';

const CATEGORY_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-teal-500',
];

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminDashboard()
      .then(setData)
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
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

  if (error) return <div className="py-20 text-center text-sm text-red-400">{error}</div>;
  if (!data) return null;

  const completionRate = data.overallCompletionRate.toFixed(1);

  return (
    <div className="flex flex-col gap-5">

      {/* ── 어드민 히어로 배너 ── */}
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 shadow-md"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 55%, #2563EB 100%)' }}>
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/[0.03] rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute right-20 bottom-0 w-32 h-32 bg-blue-400/[0.08] rounded-full translate-y-1/2 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/20 border border-orange-400/30 rounded-lg text-[11px] font-bold text-orange-300">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                </svg>
                관리자 대시보드
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              교육 현황 한눈에 보기
            </h2>
            <p className="text-blue-200/70 text-sm mt-2">
              전체 임직원 교육 이수 현황과 마감 임박 강좌를 실시간으로 관리하세요.
            </p>
          </div>

          {/* 이수율 미니 위젯 */}
          <div className="sm:shrink-0 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 flex flex-col items-center min-w-[130px]">
            <span className="text-3xl font-black text-white">{completionRate}%</span>
            <span className="text-blue-200 text-xs mt-0.5 font-medium">전체 이수율</span>
            <div className="w-full h-1.5 bg-white/20 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-700"
                style={{ width: `${Math.min(parseFloat(completionRate), 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 4개 스탯 카드 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: '전체 직원', value: data.totalEmployees, unit: '명',
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
            iconBg: 'bg-blue-100 text-blue-600', valueCls: 'text-blue-700', borderCls: 'border-t-blue-500',
            href: '/admin/employees',
          },
          {
            label: '운영 강좌', value: data.totalCourses, unit: '개',
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
            iconBg: 'bg-violet-100 text-violet-600', valueCls: 'text-violet-700', borderCls: 'border-t-violet-500',
            href: '/admin/courses',
          },
          {
            label: '미이수자', value: data.notCompletedCount, unit: '명',
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
            iconBg: 'bg-red-100 text-red-500', valueCls: 'text-red-600', borderCls: 'border-t-red-500',
            href: '/admin/completion',
          },
          {
            label: '전체 이수율', value: `${completionRate}%`, unit: '',
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 4 12 14.01 9 11.01"/><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/></svg>,
            iconBg: 'bg-emerald-100 text-emerald-600', valueCls: 'text-emerald-700', borderCls: 'border-t-emerald-500',
            href: undefined,
          },
        ].map((item) => {
          const card = (
            <div className={`bg-white rounded-2xl border-t-[3px] ${item.borderCls} border-x-0 border-b-0 shadow-sm p-4 flex items-center gap-3.5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-default`}>
              <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0`}>
                {item.icon}
              </div>
              <div>
                <div className={`text-2xl font-black ${item.valueCls}`}>{item.value}</div>
                <div className="text-[11px] text-slate-400 font-medium mt-0.5">{item.label}{item.unit && <span className="ml-0.5">{item.unit}</span>}</div>
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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

        {/* 부서별 이수율 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded-full block" />
              부서별 이수율
            </h3>
          </div>
          {data.deptStats.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">데이터 없음</p>
          ) : (
            <div className="flex flex-col gap-4">
              {data.deptStats.map((d, i) => (
                <div key={`${d.dept}-${i}`}>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold text-slate-600">{d.dept}</span>
                    <span className="font-black text-slate-800">{d.completionRate.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} rounded-full transition-all duration-700`}
                      style={{ width: `${Math.min(d.completionRate, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 우측 패널 */}
        <div className="flex flex-col gap-4">

          {/* 마감 임박 강의 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-1 h-4 bg-amber-500 rounded-full block" />
                마감 임박 강의
              </h3>
              <Link href="/admin/completion" className="text-[11px] text-blue-600 font-semibold hover:underline">
                전체보기 →
              </Link>
            </div>
            {data.deadlineAlerts.length === 0 ? (
              <div className="py-6 text-center">
                <div className="text-2xl mb-1.5">✅</div>
                <p className="text-xs text-slate-400">마감 임박 강의 없음</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {data.deadlineAlerts.map((a, i) => (
                  <div key={`${a.courseId}-${i}`}
                    className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-700 truncate">{a.title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        마감: {a.deadline}
                      </div>
                    </div>
                    <div className="shrink-0 text-right ml-3">
                      <div className="text-sm font-black text-amber-600">{a.notCompletedCount}명</div>
                      <div className="text-[10px] text-slate-400">미이수</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 빠른 링크 */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/admin/employees', label: '직원 관리', icon: '👥', color: 'bg-blue-50 border-blue-100 hover:bg-blue-100' },
              { href: '/admin/courses',   label: '강의 관리', icon: '📚', color: 'bg-violet-50 border-violet-100 hover:bg-violet-100' },
              { href: '/admin/completion',label: '이수 현황', icon: '✅', color: 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100' },
              { href: '/admin/notices',   label: '공지사항', icon: '📢', color: 'bg-amber-50 border-amber-100 hover:bg-amber-100' },
            ].map(({ href, label, icon, color }) => (
              <Link key={href} href={href}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border ${color} transition-colors text-center`}>
                <span className="text-xl">{icon}</span>
                <span className="text-[11px] font-bold text-slate-600">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── 이수율 하위 직원 ── */}
      {data.lowProgressList.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <span className="w-1 h-4 bg-red-400 rounded-full block" />
              이수율 하위 직원
            </h3>
            <span className="text-[11px] text-slate-400">{data.lowProgressList.length}명</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {['이름', '부서', '직군', '이수율'].map((h) => (
                    <th key={h} className={`pb-2.5 font-semibold text-slate-400 ${h === '이수율' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.lowProgressList.map((p, i) => (
                  <tr key={`${p.userId}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 font-semibold text-slate-700">{p.name}</td>
                    <td className="py-2.5 text-slate-500">{p.department}</td>
                    <td className="py-2.5 text-slate-500">
                      {p.role === 'ROLE_ADMIN' ? '관리자' : '일반'}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`inline-flex items-center gap-1 font-bold ${
                        p.completionRate < 30 ? 'text-red-500' : p.completionRate < 60 ? 'text-amber-500' : 'text-slate-600'
                      }`}>
                        {p.completionRate < 30 && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                        )}
                        {p.completionRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
