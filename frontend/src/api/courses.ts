import client from './client';
import type { CommonResponse, CourseListItem, CourseDetailResponse } from './types';

export async function getCourses(): Promise<CourseListItem[]> {
  const res = await client.get<CourseListItem[]>('/api/user/courses');
  return res.data ?? [];
}

export async function getCourseDetail(courseId: number): Promise<CourseDetailResponse> {
  const res = await client.get<CommonResponse<CourseDetailResponse>>(`/api/user/courses/${courseId}`);
  return res.data.data;
}

export async function enrollCourse(courseId: number): Promise<void> {
  await client.post(`/api/user/courses/${courseId}/enroll`);
}
