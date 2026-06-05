import client from './client';
import type { CalendarItem } from './types';

export async function getCalendar(): Promise<CalendarItem[]> {
  const res = await client.get<CalendarItem[]>('/api/user/calendar');
  return res.data;
}
