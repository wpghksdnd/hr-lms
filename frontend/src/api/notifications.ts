import client from './client';
import type { NotificationItem } from './types';

export async function getNotifications(): Promise<NotificationItem[]> {
  const res = await client.get<NotificationItem[]>('/api/user/notifications');
  return res.data;
}

export async function getNotificationDetail(notificationId: number): Promise<NotificationItem> {
  const res = await client.get<NotificationItem>(`/api/user/notifications/${notificationId}`);
  return res.data;
}

export async function getUnreadCount(): Promise<number> {
  const res = await client.get<{ unreadCount: number }>('/api/user/notifications/count');
  return res.data.unreadCount;
}

export async function markAsRead(notificationId: number): Promise<void> {
  await client.put(`/api/user/notifications/${notificationId}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await client.put('/api/user/notifications/read-all');
}
