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
    <div className="min-h-screen text-sm text-[#1a1a1a] bg-[#f5f5f3]">
      {/* 상단 헤더 — 고정, 전체 너비 */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6 bg-white border-b border-black/[0.06]">
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

            {notiOpen && (
              <div className="absolute right-0 top-10 w-[min(20rem,calc(100vw-1.5rem))] bg-white border border-black/[0.08] rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.06]">
                  <span className="text-xs font-bold text-gray-700">알림</span>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-[10px] text-[#185FA5] hover:underline font-semibold">
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
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-black/[0.04] transition-colors ${n.read ? 'bg-white' : 'bg-blue-50/60 hover:bg-blue-50'}`}>
                        <span className="text-base shrink-0 mt-0.5">{getNotificationIcon(n.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-snug truncate ${n.read ? 'text-gray-500' : 'text-gray-800 font-semibold'}`}>
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
                <Link href="/notifications" onClick={() => setNotiOpen(false)}
                  className="block px-4 py-2.5 text-center text-xs font-bold text-[#185FA5] bg-gray-50 hover:bg-gray-100">
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

      {/* 사이드바 + 본문 */}
      <div className="flex pt-14">
        <UserSidebar />
        <main className="ml-16 flex-1 p-4 sm:p-6">
          <div className="max-w-[1200px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
