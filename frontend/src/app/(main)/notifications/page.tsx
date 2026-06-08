'use client';

import { useEffect, useMemo, useState } from 'react';
import { getNotificationDetail, getNotifications, markAllAsRead } from '@/api/notifications';
import type { NotificationItem } from '@/api/types';
import {
  formatNotificationDate,
  getNotificationContent,
  getNotificationIcon,
  getNotificationTitle,
} from '@/utils/notificationUi';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const list = await getNotifications();
        setNotifications(list);

        const params = new URLSearchParams(window.location.search);
        const requestedId = Number(params.get('notificationId'));

        if (requestedId) {
          const initial = list.find((item) => item.notificationId === requestedId);
          if (initial) {
            await openNotification(initial, list);
          } else {
            setSelected(list[0] ?? null);
          }
        } else {
          setSelected(list[0] ?? null);
        }
      } catch {
        setError('알림을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openNotification(notification: NotificationItem, currentList = notifications) {
    try {
      const detail = await getNotificationDetail(notification.notificationId);
      setSelected(detail);
      setNotifications(currentList.map((item) => (
        item.notificationId === detail.notificationId ? { ...item, ...detail, read: true } : item
      )));
      window.dispatchEvent(new Event('notifications:updated'));
    } catch {
      setSelected(notification);
    }
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead().catch(() => {});
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    setSelected((prev) => prev ? { ...prev, read: true } : prev);
    window.dispatchEvent(new Event('notifications:updated'));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-xs text-gray-400">알림을 불러오는 중...</div>;
  }

  return (
    <div className="flex flex-col gap-5 text-gray-900 dark:text-gray-100">
      <section className="flex flex-col gap-3 rounded-xl border border-black/[0.06] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-950 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight">알림함</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            신규 공지와 수강, 마감, 이수증 발급 알림을 확인할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#185FA5] dark:bg-blue-950/50 dark:text-blue-200">
            미확인 {unreadCount}건
          </span>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-gray-200 dark:hover:bg-neutral-900"
          >
            모두 읽음
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
        <section className="overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-sm dark:border-white/10 dark:bg-neutral-950">
          <div className="grid grid-cols-[64px_1fr_116px] border-b border-black/[0.06] bg-gray-50 px-4 py-3 text-[11px] font-bold text-gray-500 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-400">
            <span>상태</span>
            <span>제목</span>
            <span className="text-right">생성일</span>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-400">알림이 없습니다.</div>
            ) : (
              notifications.map((notification) => {
                const isSelected = selected?.notificationId === notification.notificationId;
                return (
                  <button
                    key={notification.notificationId}
                    type="button"
                    onClick={() => openNotification(notification)}
                    className={`grid w-full grid-cols-[64px_1fr_116px] items-center gap-2 border-b border-black/[0.04] px-4 py-3 text-left transition-colors dark:border-white/10 ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40'
                        : notification.read
                          ? 'bg-white hover:bg-gray-50 dark:bg-neutral-950 dark:hover:bg-neutral-900'
                          : 'bg-sky-50/70 hover:bg-sky-50 dark:bg-sky-950/30 dark:hover:bg-sky-950/50'
                    }`}
                  >
                    <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-black ${
                      notification.read
                        ? 'bg-gray-100 text-gray-400 dark:bg-neutral-800 dark:text-gray-500'
                        : 'bg-[#185FA5] text-white'
                    }`}>
                      {notification.read ? '읽음' : '신규'}
                    </span>
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-base">{getNotificationIcon(notification.type)}</span>
                        <span className={`truncate text-sm ${notification.read ? 'text-gray-500 dark:text-gray-400' : 'font-bold text-gray-900 dark:text-gray-100'}`}>
                          {getNotificationTitle(notification)}
                        </span>
                      </span>
                    </span>
                    <span className="text-right text-[11px] text-gray-400">
                      {formatNotificationDate(notification.createdAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <aside className="rounded-xl border border-black/[0.06] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-950">
          {selected ? (
            <div className="flex h-full flex-col gap-4">
              <div className="flex items-start gap-3 border-b border-black/[0.06] pb-4 dark:border-white/10">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl dark:bg-blue-950/50">
                  {getNotificationIcon(selected.type)}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#185FA5]">{selected.read ? '읽음' : '신규'}</p>
                  <h3 className="mt-1 text-base font-black leading-snug">{getNotificationTitle(selected)}</h3>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {formatNotificationDate(selected.createdAt, 'datetime')}
                  </p>
                </div>
              </div>
              <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm leading-7 text-gray-700 dark:bg-neutral-900 dark:text-gray-200">
                {getNotificationContent(selected)}
              </div>
            </div>
          ) : (
            <div className="flex min-h-64 items-center justify-center text-center text-xs text-gray-400">
              확인할 알림을 선택하세요.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
