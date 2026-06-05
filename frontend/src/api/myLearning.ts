import client from './client';
import type { CommonResponse, Page, MyCourseResponse, MyCourseDetailResponse, VideoListResponse, FeedbackResponse, EnrollmentHistoryItem } from './types';

export async function getEnrollmentHistory(): Promise<EnrollmentHistoryItem[]> {
  const res = await client.get<EnrollmentHistoryItem[]>('/api/user/enrollments/history');
  return res.data;
}

export async function cancelEnrollment(enrollmentId: number): Promise<void> {
  await client.delete(`/api/user/enrollments/cancel/${enrollmentId}`);
}

export async function submitFeedback(enrollmentId: number, rating: number, comment: string): Promise<FeedbackResponse> {
  const res = await client.post<FeedbackResponse>(`/api/user/enrollments/${enrollmentId}/feedback`, { rating, comment });
  return res.data;
}

export async function getFeedback(enrollmentId: number): Promise<FeedbackResponse | null> {
  const res = await client.get<FeedbackResponse | null>(`/api/user/enrollments/${enrollmentId}/feedback`).catch(() => null);
  return res?.data ?? null;
}

export async function getMyCourses(page = 0, size = 10): Promise<Page<MyCourseResponse>> {
  const res = await client.get<CommonResponse<Page<MyCourseResponse>>>('/api/user/my-courses', {
    params: { page, size },
  });
  return res.data.data;
}

export async function getMyCourseDetail(courseId: number): Promise<MyCourseDetailResponse> {
  const res = await client.get<CommonResponse<MyCourseDetailResponse>>(`/api/user/my-courses/${courseId}`);
  return res.data.data;
}

export async function getCourseVideos(courseId: number): Promise<VideoListResponse> {
  const res = await client.get<CommonResponse<VideoListResponse>>(`/api/user/courses/${courseId}/videos`);
  return res.data.data;
}

export async function recordVideoWatch(videoId: number, watchedSec: number): Promise<void> {
  await client.post(`/api/user/videos/${videoId}/watch`, { watchedSec });
}

export async function startVideoWatch(videoId: number): Promise<void> {
  await client.post(`/api/user/videos/${videoId}/watch/start`);
}

export interface WatchEndResult {
  videoId: number;
  watchedSec: number;
  videoCompleted: boolean;
  lectureCompleted: boolean;
}

export async function endVideoWatch(videoId: number, watchedSec: number): Promise<WatchEndResult> {
  const res = await client.post<WatchEndResult>(
    `/api/user/videos/${videoId}/watch/end`,
    null,
    { params: { watchedSec } },
  );
  return res.data;
}

export async function completeLecture(lectureId: number): Promise<void> {
  await client.put(`/api/user/lectures/${lectureId}/complete`);
}
