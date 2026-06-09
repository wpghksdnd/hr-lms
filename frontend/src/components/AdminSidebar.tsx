'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/admin/dashboard',
    label: '대시보드',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/admin/employees',
    label: '직원 관리',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/admin/courses',
    label: '강의 관리',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    href: '/admin/completion',
    label: '이수 현황',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    href: '/admin/notices',
    label: '공지사항',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3z" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    href: '/admin/qna',
    label: 'Q&A 관리',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    href: '/admin/certificates',
    label: '이수증',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
  },
  {
    href: '/admin/notifications',
    label: '알림 발송',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="group fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-16 hover:w-56 transition-[width] duration-300 ease-out bg-[#0F172A] flex flex-col overflow-hidden z-40 shadow-[2px_0_20px_rgba(0,0,0,0.15)]">
      <nav className="flex-1 py-4 px-2.5 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all duration-200 overflow-hidden ${
                active
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-400 rounded-r-full" />
              )}
              <span className="shrink-0 w-5 h-5 flex items-center justify-center ml-0.5">
                {icon}
              </span>
              <span className="text-[13px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="pb-4 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="border-t border-white/[0.06] pt-3 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-orange-600/30 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fdba74" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
          </div>
          <span className="text-[11px] text-slate-600 font-semibold tracking-wide">관리자</span>
        </div>
      </div>
    </aside>
  );
}
