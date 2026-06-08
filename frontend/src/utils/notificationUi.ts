import type { NotificationItem, NotificationType } from '@/api/types';

const NOTIFICATION_ICON: Record<NotificationType, string> = {
  NEW_NOTICE: '📢',
  COURSE_STARTED: '🎓',
  ENROLLMENT_APPROVED: '✅',
  ENROLLMENT_REJECTED: '⚠️',
  COURSE_DEADLINE: '📅',
  CERTIFICATE_ISSUED: '🏆',
  SYSTEM: '🔔',
};

export function getNotificationIcon(type: string) {
  return NOTIFICATION_ICON[type as NotificationType] ?? '🔔';
}

export function getNotificationTitle(notification: NotificationItem) {
  const title = notification.title?.trim();
  if (title) return title;

  const firstLine = notification.message?.split('\n')[0] ?? '';
  return firstLine.replace(/^\[[^\]]+\]\s*/, '').trim() || '알림';
}

export function getNotificationContent(notification: NotificationItem) {
  return notification.content?.trim() || notification.message?.trim() || '';
}

export function formatNotificationDate(value: string, mode: 'date' | 'datetime' | 'short' = 'date') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  if (mode === 'datetime') {
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (mode === 'short') {
    return date.toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
