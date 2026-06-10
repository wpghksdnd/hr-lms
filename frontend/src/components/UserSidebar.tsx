'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_TABS = [
  {
    href: '/dashboard',
    label: '대시보드',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/courses',
    label: '수강신청',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    href: '/learning',
    label: '동영상 학습',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" />
      </svg>
    ),
  },
  {
    href: '/calendar',
    label: '캘린더',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: '/notices',
    label: '공지사항',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3z" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    href: '/qna',
    label: 'Q&A',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <line x1="9" y1="10" x2="9" y2="10" strokeWidth="3" strokeLinecap="round"/>
        <line x1="12" y1="10" x2="12" y2="10" strokeWidth="3" strokeLinecap="round"/>
        <line x1="15" y1="10" x2="15" y2="10" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/chatbot',
    label: 'AI 챗봇',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/mypage',
    label: '마이페이지',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function UserSidebar() {
  const pathname = usePathname();

  return (
    <aside className="group fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-16 hover:w-56 transition-[width] duration-300 ease-out bg-[#0F172A] flex flex-col overflow-hidden z-40 shadow-[2px_0_20px_rgba(0,0,0,0.15)]">
      <nav className="flex-1 py-4 px-2.5 flex flex-col gap-0.5">
        {NAV_TABS.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
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

      {/* Bottom brand mark */}
      <div className="pb-4 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="border-t border-white/[0.06] pt-3 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-blue-600/30 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <span className="text-[11px] text-slate-600 font-semibold tracking-wide">INSIGHT</span>
        </div>
      </div>
    </aside>
  );
}
