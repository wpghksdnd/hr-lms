'use client';
import { useEffect, useState } from 'react';
import {
  getAdminQna,
  addQnaAnswer,
  updateQnaAnswer,
  deleteQnaAnswer,
  resolveQnaQuestion,
  type QnaQuestionItem,
  type QnaAnswerItem,
} from '@/api/adminApi';

export default function AdminQnaPage() {
  const [questions, setQuestions] = useState<QnaQuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 답변 입력 상태
  const [answerDraft, setAnswerDraft] = useState<Record<number, string>>({});
  // 수정 중인 답변
  const [editingAnswer, setEditingAnswer] = useState<{ answerId: number; content: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    getAdminQna(unansweredOnly)
      .then(setQuestions)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [unansweredOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = (id: number) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const handleAnswer = async (questionId: number) => {
    const content = (answerDraft[questionId] ?? '').trim();
    if (!content) return;
    setSubmitting(true);
    try {
      await addQnaAnswer(questionId, content);
      setAnswerDraft((prev) => ({ ...prev, [questionId]: '' }));
      load();
    } catch {
      alert('답변 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingAnswer) return;
    setSubmitting(true);
    try {
      await updateQnaAnswer(editingAnswer.answerId, editingAnswer.content);
      setEditingAnswer(null);
      load();
    } catch {
      alert('답변 수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnswer = async (answerId: number) => {
    if (!confirm('답변을 삭제하시겠습니까?')) return;
    try {
      await deleteQnaAnswer(answerId);
      load();
    } catch {
      alert('답변 삭제에 실패했습니다.');
    }
  };

  const handleResolve = async (questionId: number) => {
    if (!confirm('해결 완료로 처리하시겠습니까?')) return;
    try {
      await resolveQnaQuestion(questionId);
      load();
    } catch {
      alert('처리에 실패했습니다.');
    }
  };

  const unansweredCount = questions.filter((q) => q.answerCount === 0).length;
  const unresolvedCount = questions.filter((q) => !q.resolved).length;

  return (
    <div className="flex flex-col gap-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[#111]">Q&A 관리</h1>
          <p className="text-xs text-gray-400 mt-0.5">직원들의 질문에 답변하고 해결 처리합니다.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white border border-black/[0.06] rounded-xl px-4 py-2 text-center shadow-sm">
            <div className="text-lg font-black text-[#185FA5]">{unansweredCount}</div>
            <div className="text-[10px] text-gray-400">미답변</div>
          </div>
          <div className="bg-white border border-black/[0.06] rounded-xl px-4 py-2 text-center shadow-sm">
            <div className="text-lg font-black text-orange-500">{unresolvedCount}</div>
            <div className="text-[10px] text-gray-400">미해결</div>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setUnansweredOnly(false)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            !unansweredOnly ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setUnansweredOnly(true)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            unansweredOnly ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          미답변만
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-xs text-gray-400">불러오는 중...</div>
      ) : questions.length === 0 ? (
        <div className="bg-white border border-black/[0.06] rounded-xl p-12 text-center text-gray-400 text-sm">
          {unansweredOnly ? '미답변 질문이 없습니다.' : '등록된 질문이 없습니다.'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q) => (
            <div
              key={q.questionId}
              className={`bg-white border rounded-xl shadow-sm overflow-hidden ${
                q.resolved ? 'border-emerald-100' : q.answerCount === 0 ? 'border-red-100' : 'border-black/[0.06]'
              }`}
            >
              {/* 질문 헤더 */}
              <button
                onClick={() => toggleExpand(q.questionId)}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {q.resolved ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600">해결</span>
                    ) : q.answerCount === 0 ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-500">미답변</span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">답변완료</span>
                    )}
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{q.courseTitle}</span>
                  </div>
                  <p className="text-[13px] font-bold text-[#111] truncate">{q.title}</p>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span>{q.userName}</span>
                    <span>·</span>
                    <span>{new Date(q.createdAt).toLocaleDateString('ko-KR')}</span>
                    <span>·</span>
                    <span>답변 {q.answerCount}개</span>
                  </div>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 shrink-0 mt-1 transition-transform ${expandedId === q.questionId ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 펼쳐진 내용 */}
              {expandedId === q.questionId && (
                <div className="border-t border-black/[0.06] px-4 pb-4 pt-3 flex flex-col gap-4">
                  {/* 질문 본문 */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-[#333] leading-relaxed whitespace-pre-wrap">{q.content}</p>
                  </div>

                  {/* 기존 답변 목록 */}
                  {q.answers.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">답변 {q.answers.length}개</p>
                      {q.answers.map((ans: QnaAnswerItem) => (
                        <div key={ans.answerId} className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                          {editingAnswer?.answerId === ans.answerId ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={editingAnswer.content}
                                onChange={(e) => setEditingAnswer({ ...editingAnswer, content: e.target.value })}
                                rows={3}
                                className="w-full text-xs border border-blue-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#185FA5] resize-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={handleEditSave}
                                  disabled={submitting}
                                  className="px-3 py-1 text-xs bg-[#185FA5] text-white rounded-lg hover:bg-[#144f8b] disabled:bg-gray-300"
                                >
                                  저장
                                </button>
                                <button
                                  onClick={() => setEditingAnswer(null)}
                                  className="px-3 py-1 text-xs bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-blue-700">{ans.authorName} (관리자)</span>
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => setEditingAnswer({ answerId: ans.answerId, content: ans.content })}
                                    className="text-[10px] text-gray-400 hover:text-[#185FA5]"
                                  >
                                    수정
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAnswer(ans.answerId)}
                                    className="text-[10px] text-gray-400 hover:text-red-500"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-[#333] leading-relaxed whitespace-pre-wrap">{ans.content}</p>
                              <p className="text-[10px] text-gray-400 mt-1">{new Date(ans.createdAt).toLocaleString('ko-KR')}</p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 답변 입력 */}
                  {!q.resolved && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] font-bold text-gray-500">
                        {q.answerCount > 0 ? '추가 답변 작성' : '답변 작성'}
                      </p>
                      <textarea
                        value={answerDraft[q.questionId] ?? ''}
                        onChange={(e) =>
                          setAnswerDraft((prev) => ({ ...prev, [q.questionId]: e.target.value }))
                        }
                        rows={3}
                        placeholder="답변 내용을 입력해 주세요..."
                        className="w-full text-xs border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#185FA5] resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAnswer(q.questionId)}
                          disabled={submitting || !(answerDraft[q.questionId] ?? '').trim()}
                          className="px-4 py-1.5 text-xs bg-[#185FA5] text-white rounded-lg hover:bg-[#144f8b] disabled:bg-gray-300 font-bold"
                        >
                          {submitting ? '등록 중...' : '답변 등록'}
                        </button>
                        {q.answerCount > 0 && (
                          <button
                            onClick={() => handleResolve(q.questionId)}
                            className="px-4 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-bold"
                          >
                            해결 완료 처리
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 이미 해결된 경우 */}
                  {q.resolved && (
                    <div className="text-xs text-emerald-600 font-semibold text-center py-1">
                      ✓ 해결 완료된 질문입니다.
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
