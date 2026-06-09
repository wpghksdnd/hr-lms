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
    <div className="min-h-screen bg-[#f5f5f3]">
      {/* 상단 헤더 — 고정, 전체 너비 */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#1a1a2e] text-white flex items-center justify-between px-6">
        <Link href="/admin/dashboard" className="text-lg font-black tracking-tight text-[#4A90D9]">
          LMS <span className="text-white text-sm font-normal">관리자</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{adminName}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 사이드바 + 본문 */}
      <div className="flex pt-14">
        <AdminSidebar />
        <main className="ml-16 flex-1 px-4 md:px-6 py-6">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
