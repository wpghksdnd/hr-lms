'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: '대시보드',    href: '/admin/dashboard' },
  { label: '직원 관리',   href: '/admin/employees' },
  { label: '강의 관리',   href: '/admin/courses' },
  { label: '이수 현황',   href: '/admin/completion' },
  { label: '공지사항',    href: '/admin/notices' },
  { label: 'Q&A 관리',   href: '/admin/qna' },
  { label: '이수증',     href: '/admin/certificates' },
  { label: '알림 발송',  href: '/admin/notifications' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [adminName, setAdminName] = useState('관리자');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    const stored = localStorage.getItem('user');
    if (!stored) {
      // user 정보 없으면 비정상 상태 — 로그인으로 이동
      router.replace('/login');
      return;
    }
    const user = JSON.parse(stored);
    if (user.role !== 'ROLE_ADMIN') { router.replace('/dashboard'); return; }
    setAdminName(user.name ?? '관리자');
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      {/* Top Header */}
      <header className="bg-[#1a1a2e] text-white sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin/dashboard" className="text-lg font-black tracking-tight text-[#4A90D9]">
              LMS <span className="text-white text-sm font-normal">관리자</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#4A90D9]/20 text-[#4A90D9]'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{adminName}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden flex overflow-x-auto border-t border-white/10 px-2 pb-1 pt-0.5 gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active ? 'text-[#4A90D9]' : 'text-gray-400'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
