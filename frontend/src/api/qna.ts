import client from './client';
import type { CommonResponse, QnaResponse } from './types';

export interface CreateQuestionRequest {
  courseId: number;
  title: string;
  content: string;
}

export interface QnaBoardItem {
  questionId: number;
  courseId: number;
  courseTitle: string;
  title: string;
  authorName: string;
  resolved: boolean;
  answerCount: number;
  isMine: boolean;
  createdAt: string;
}

/** 게시판 전체 목록 (내용 없음, isMine 포함) */
export async function getBoardQuestions(): Promise<QnaBoardItem[]> {
  const res = await client.get<CommonResponse<QnaBoardItem[]>>('/api/user/qna/questions/board');
  return res.data.data;
}

/** 내 질문 상세 (본인만 호출 가능) */
export async function getMyQuestions(courseId?: number): Promise<QnaResponse[]> {
  const res = await client.get<CommonResponse<QnaResponse[]>>('/api/user/qna/questions', {
    params: courseId ? { courseId } : undefined,
  });
  return res.data.data;
}

export async function getQuestionDetail(questionId: number): Promise<QnaResponse> {
  const res = await client.get<CommonResponse<QnaResponse>>(`/api/user/qna/questions/${questionId}`);
  return res.data.data;
}

export async function createQuestion(data: CreateQuestionRequest): Promise<QnaResponse> {
  const res = await client.post<CommonResponse<QnaResponse>>('/api/user/qna/questions', data);
  return res.data.data;
}
