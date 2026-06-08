'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LoginResponse } from '@/api/auth';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/api/notifications';
import type { NotificationItem } from '@/api/types';
import { formatNotificationDate, getNotificationIcon, getNotificationTitle } from '@/utils/notificationUi';

const NAV_TABS = [
  { href: '/dashboard', label: '홈' },
  { href: '/courses', label: '수강신청' },
  { href: '/learning', label: '동영상 학습' },
  { href: '/calendar', label: '캘린더' },
  { href: '/notices', label: '공지사항' },
  { href: '/chatbot', label: 'AI 챗봇' },
  { href: '/mypage', label: '마이페이지' },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<LoginResponse | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notiOpen, setNotiOpen] = useState(false);
  const notiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    const stored = localStorage.getItem('user');
    if (stored) setUserInfo(JSON.parse(stored));
    const refreshUnreadCount = () => getUnreadCount().then(setUnreadCount).catch(() => {});
    // 알림 개수 초기 로드
    refreshUnreadCount();
    window.addEventListener('notifications:updated', refreshUnreadCount);
    // 30초마다 갱신
    const timer = setInterval(refreshUnreadCount, 30000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('notifications:updated', refreshUnreadCount);
    };
  }, [router]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) setNotiOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openNoti = async () => {
    if (!notiOpen) {
      const list = await getNotifications().catch(() => []);
      setNotifications(list);
    }
    setNotiOpen((v) => !v);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleOpenNotification = async (notification: NotificationItem) => {
    if (!notification.read) {
      await markAsRead(notification.notificationId).catch(() => {});
      setNotifications((prev) => prev.map((n) => n.notificationId === notification.notificationId ? { ...n, read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setNotiOpen(false);
    router.push(`/notifications?notificationId=${notification.notificationId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.replace('/login');
  };

  return (
    <div className="min-h-screen text-sm text-[#1a1a1a] bg-[#f5f5f3]">
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-black/[0.06]">
        <Link href="/dashboard" className="text-base font-bold">
          <span className="text-[#185FA5] text-lg font-black tracking-tight mr-1">LMS</span> 사내교육시스템
        </Link>
        <div className="flex items-center gap-3">
          {/* 알림 벨 */}
          <div className="relative" ref={notiRef}>
            <button onClick={openNoti}
              aria-label={`알림 ${unreadCount > 0 ? `(읽지 않은 알림 ${unreadCount}개)` : ''}`}
              className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <span aria-hidden className="text-lg leading-none">🔔</span>
              <span className="sr-only">알림</span>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* 알림 드롭다운 */}
            {notiOpen && (
              <div className="absolute right-0 top-10 w-[min(20rem,calc(100vw-1.5rem))] bg-white dark:bg-neutral-950 border border-black/[0.08] dark:border-white/10 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.06] dark:border-white/10">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-100">알림</span>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead}
                      className="text-[10px] text-[#185FA5] hover:underline font-semibold">
                      모두 읽음
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">알림이 없습니다.</div>
                  ) : (
                    notifications.slice(0, 5).map((n) => (
                      <button key={n.notificationId}
                        onClick={() => handleOpenNotification(n)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-black/[0.04] dark:border-white/10 transition-colors ${n.read ? 'bg-white dark:bg-neutral-950' : 'bg-blue-50/60 hover:bg-blue-50 dark:bg-blue-950/40 dark:hover:bg-blue-950/60'}`}>
                        <span className="text-base shrink-0 mt-0.5">{getNotificationIcon(n.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-snug truncate ${n.read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-100 font-semibold'}`}>
                            {getNotificationTitle(n)}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {formatNotificationDate(n.createdAt, 'short')}
                          </p>
                        </div>
                        {!n.read && <span className="w-2 h-2 bg-[#185FA5] rounded-full shrink-0 mt-1.5" />}
                      </button>
                    ))
                  )}
                </div>
                <Link
                  href="/notifications"
                  onClick={() => setNotiOpen(false)}
                  className="block px-4 py-2.5 text-center text-xs font-bold text-[#185FA5] bg-gray-50 hover:bg-gray-100 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                >
                  전체보기
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#666] font-medium hidden sm:inline">{userInfo?.name ?? ''}</span>
            <div className="w-7 h-7 rounded-full bg-[#E6F1FB] flex items-center justify-center text-xs font-bold text-[#185FA5]">
              {userInfo?.name?.[0] ?? '?'}
            </div>
          </div>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-500 border border-black/10 px-2 py-0.5 rounded">
            로그아웃
          </button>
        </div>
      </header>

      <nav className="flex justify-center gap-1.5 px-5 bg-white border-b border-black/[0.08] overflow-x-auto">
        {NAV_TABS.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== '/dashboard' && pathname.startsWith(tab.href));
          return (
            <Link key={tab.href} href={tab.href}
              className={`px-5 py-3 text-[13px] font-medium rounded-t-lg transition-all border-b-2 -mb-[1px] whitespace-nowrap ${
                isActive
                  ? 'bg-[#f5f5f3] text-[#185FA5] font-bold border-b-transparent border-t border-x border-black/[0.08]'
                  : 'text-[#888] border-b-transparent hover:text-[#185FA5]'
              }`}>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <main className="p-4 sm:p-6 max-w-[1200px] mx-auto">
        {children}
      </main>
    </div>
  );
}
