import client from './client';
import type { CommonResponse, AssessmentResponse, AttemptResponse } from './types';

// 퀴즈
export async function getQuiz(lectureId: number): Promise<AssessmentResponse> {
  const res = await client.get<CommonResponse<AssessmentResponse>>(`/api/user/quizzes/${lectureId}`);
  return res.data.data;
}

export async function submitQuiz(quizId: number, answers: Record<number, number>): Promise<AttemptResponse> {
  const res = await client.post<CommonResponse<AttemptResponse>>(`/api/user/quizzes/${quizId}/submit`, { answers });
  return res.data.data;
}

// 시험
export async function getExam(courseId: number): Promise<AssessmentResponse> {
  const res = await client.get<CommonResponse<AssessmentResponse>>(`/api/user/exams/${courseId}`);
  return res.data.data;
}

export async function submitExam(examId: number, answers: Record<number, number>): Promise<AttemptResponse> {
  const res = await client.post<CommonResponse<AttemptResponse>>(`/api/user/exams/${examId}/submit`, { answers });
  return res.data.data;
}

export async function getMyExamResults(): Promise<AttemptResponse[]> {
  const res = await client.get<CommonResponse<AttemptResponse[]>>('/api/user/exams/results');
  return res.data.data;
}

// 특정 강좌의 내 시험 응시 이력
export async function getMyExamAttempts(courseId: number): Promise<AttemptResponse[]> {
  const res = await client.get<AttemptResponse[]>(`/api/user/courses/${courseId}/exam/attempts`);
  return Array.isArray(res.data) ? res.data : [];
}
