'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LoginResponse } from '@/api/auth';
import { logout } from '@/api/auth';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/api/notifications';
import type { NotificationItem } from '@/api/types';
import { formatNotificationDate, getNotificationIcon, getNotificationTitle } from '@/utils/notificationUi';
import UserSidebar from '@/components/UserSidebar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<LoginResponse | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notiOpen, setNotiOpen] = useState(false);
  const notiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.replace('/login'); return; }
    try { setUserInfo(JSON.parse(stored)); } catch { localStorage.removeItem('user'); router.replace('/login'); return; }
    const refreshUnreadCount = () => getUnreadCount().then(setUnreadCount).catch(() => {});
    refreshUnreadCount();
    window.addEventListener('notifications:updated', refreshUnreadCount);
    const timer = setInterval(refreshUnreadCount, 30000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('notifications:updated', refreshUnreadCount);
    };
  }, [router]);

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
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#2563EB] flex items-center justify-center shadow-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <span className="font-black text-[15px] text-slate-900 tracking-tight">
            INSIGHT
            <span className="font-normal text-slate-400 text-xs ml-1.5">사내교육</span>
          </span>
        </Link>

        {/* 우측 액션 */}
        <div className="flex items-center gap-2">

          {/* 알림 벨 */}
          <div className="relative" ref={notiRef}>
            <button onClick={openNoti}
              aria-label={`알림 ${unreadCount > 0 ? `(읽지 않은 알림 ${unreadCount}개)` : ''}`}
              className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${notiOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100 text-slate-500'}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notiOpen && (
              <div className="absolute right-0 top-11 w-[min(22rem,calc(100vw-1.5rem))] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-800">알림</span>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                      모두 읽음
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      <div className="text-2xl mb-2">🔔</div>새 알림이 없습니다.
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((n) => (
                      <button key={n.notificationId} onClick={() => handleOpenNotification(n)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-slate-50 transition-colors ${n.read ? 'hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50/80'}`}>
                        <span className="text-[16px] shrink-0 mt-0.5">{getNotificationIcon(n.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-snug truncate ${n.read ? 'text-slate-500' : 'text-slate-800 font-semibold'}`}>
                            {getNotificationTitle(n)}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{formatNotificationDate(n.createdAt, 'short')}</p>
                        </div>
                        {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />}
                      </button>
                    ))
                  )}
                </div>
                <Link href="/notifications" onClick={() => setNotiOpen(false)}
                  className="block px-4 py-2.5 text-center text-xs font-bold text-blue-600 bg-slate-50 hover:bg-slate-100 transition-colors">
                  전체보기 →
                </Link>
              </div>
            )}
          </div>

          {/* 구분선 */}
          <div className="w-px h-5 bg-slate-200" />

          {/* 유저 정보 */}
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[11px] font-black text-white shadow-sm">
              {userInfo?.name?.[0] ?? '?'}
            </div>
            <span className="text-xs text-slate-600 font-medium hidden sm:block">{userInfo?.name ?? ''}</span>
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
        <UserSidebar />
        <main className="ml-16 flex-1 p-5 sm:p-7">
          <div className="max-w-[1200px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
