'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '@/api/auth';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [adminName, setAdminName] = useState('관리자');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.replace('/login'); return; }
    try {
      const user = JSON.parse(stored);
      if (user.role !== 'ROLE_ADMIN') { router.replace('/dashboard'); return; }
      setAdminName(user.name ?? '관리자');
    } catch {
      localStorage.removeItem('user');
      router.replace('/login');
    }
  }, [router]);

  const handleLogout = async () => {
    await logout().catch(() => {});
    localStorage.removeItem('user');
    router.replace('/login');
  };

  return (
    <div className="min-h-screen text-sm text-slate-800 bg-[#F1F5F9]">

      {/* ── 상단 헤더 ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-5 bg-white border-b border-slate-200/70 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">

        {/* 로고 */}
        <Link href="/admin/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#2563EB] flex items-center justify-center shadow-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <span className="font-black text-[15px] text-slate-900 tracking-tight">
            INSIGHT
            <span className="font-normal text-slate-400 text-xs ml-1.5">관리자</span>
          </span>
        </Link>

        {/* 우측 */}
        <div className="flex items-center gap-2">
          {/* 관리자 배지 */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 border border-orange-200 rounded-lg">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
            <span className="text-[11px] font-bold text-orange-600">관리자</span>
          </div>

          <div className="w-px h-5 bg-slate-200" />

          {/* 유저 정보 */}
          <div className="flex items-center gap-2 px-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-[11px] font-black text-white shadow-sm">
              {adminName[0] ?? 'A'}
            </div>
            <span className="text-xs text-slate-600 font-medium hidden sm:block">{adminName}</span>
          </div>

          {/* 로그아웃 */}
          <button onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-all">
            로그아웃
          </button>
        </div>
      </header>

      {/* 사이드바 + 본문 */}
      <div className="flex pt-14">
        <AdminSidebar />
        <main className="ml-16 flex-1 p-5 sm:p-7">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
