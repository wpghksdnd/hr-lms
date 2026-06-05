import client from './client';
import type { CommonResponse, QnaResponse } from './types';

export interface CreateQuestionRequest {
  courseId: number;
  title: string;
  content: string;
}

export async function getMyQuestions(courseId?: number): Promise<QnaResponse[]> {
  const res = await client.get<CommonResponse<QnaResponse[]>>('/api/user/qna/questions', {
    params: courseId ? { courseId } : undefined,
  });
  return res.data.data;
}

export async function createQuestion(data: CreateQuestionRequest): Promise<QnaResponse> {
  const res = await client.post<CommonResponse<QnaResponse>>('/api/user/qna/questions', data);
  return res.data.data;
}
