import client from './client';
import type { CommonResponse, Page, NoticeListItem, NoticeDetail } from './types';

export async function getNotices(page = 0, size = 10): Promise<Page<NoticeListItem>> {
  const res = await client.get<CommonResponse<Page<NoticeListItem>>>('/api/user/notices', { params: { page, size } });
  return res.data.data;
}

export async function getNoticeDetail(noticeId: number): Promise<NoticeDetail> {
  const res = await client.get<CommonResponse<NoticeDetail>>(`/api/user/notices/${noticeId}`);
  return res.data.data;
}
