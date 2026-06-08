'use client';
import React, { useEffect, useState } from 'react';
import { createQuestion, getMyQuestions } from '@/api/qna';
import type { QnaResponse } from '@/api/types';

export function QnaPanel({ courseId }: { courseId: number | null }) {
  const [questions, setQuestions] = useState<QnaResponse[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!courseId) return;
    getMyQuestions(courseId).then(setQuestions).catch(() => {});
  }, [courseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setSubmitting(true);
    try {
      const newQ = await createQuestion({ courseId, title, content });
      setQuestions((prev) => [newQ, ...prev]);
      setTitle(''); setContent(''); setShowForm(false);
      setMsg('질문이 등록되었습니다.');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg('질문 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-400">강의 내용이 궁금하면 질문을 남겨주세요.</p>
        <button onClick={() => setShowForm((v) => !v)}
          className="text-[11px] font-bold text-[#185FA5] hover:underline shrink-0">
          {showForm ? '취소' : '+ 질문하기'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 bg-blue-50/40 border border-blue-100 rounded-lg p-3">
          <input type="text" placeholder="질문 제목" required
            className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#185FA5] bg-white"
            value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea placeholder="상세한 질문 내용" required rows={3}
            className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#185FA5] resize-none bg-white"
            value={content} onChange={(e) => setContent(e.target.value)} />
          <button type="submit" disabled={submitting}
            className="w-full py-1.5 bg-[#185FA5] text-white font-bold text-xs rounded-lg hover:bg-[#144f8b] disabled:bg-gray-300">
            {submitting ? '등록 중...' : '질문 등록'}
          </button>
        </form>
      )}

      {msg && <div className="text-xs text-emerald-600 font-semibold">{msg}</div>}

      {questions.length === 0 ? (
        <div className="text-[11px] text-gray-400 text-center py-4">아직 질문이 없습니다.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {questions.map((q) => (
            <div key={q.questionId} className={`border rounded-lg overflow-hidden ${q.resolved ? 'border-emerald-100' : 'border-gray-200'}`}>
              <button onClick={() => setExpandedId(expandedId === q.questionId ? null : q.questionId)}
                className="w-full flex items-start justify-between p-2.5 text-left hover:bg-gray-50 transition-colors">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {q.resolved
                      ? <span className="text-[9px] font-bold px-1 py-0.5 bg-emerald-100 text-emerald-600 rounded">답변완료</span>
                      : <span className="text-[9px] font-bold px-1 py-0.5 bg-orange-100 text-orange-500 rounded">답변대기</span>}
                    <span className="text-xs font-semibold text-gray-700 truncate">{q.title}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{new Date(q.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
                <svg className={`w-3.5 h-3.5 text-gray-400 shrink-0 mt-1 transition-transform ${expandedId === q.questionId ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedId === q.questionId && (
                <div className="border-t border-gray-100 px-3 py-2.5 flex flex-col gap-2.5 bg-gray-50/50">
                  <p className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap">{q.content}</p>
                  {q.answers.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {q.answers.map((a) => (
                        <div key={a.answerId} className="bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-blue-600">{a.authorName}</span>
                            <span className="text-[10px] text-gray-400">{new Date(a.createdAt).toLocaleDateString('ko-KR')}</span>
                          </div>
                          <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">{a.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
