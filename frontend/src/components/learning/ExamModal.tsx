'use client';
import { useState } from 'react';
import { submitExam } from '@/api/assessment';
import type { AssessmentResponse, QuestionItem } from '@/api/types';

interface Props {
  exam: AssessmentResponse;
  onClose: () => void;
  onResult: (passed: boolean) => void;
}

export function ExamModal({ exam, onClose, onResult }: Props) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showUnansweredOnly, setShowUnansweredOnly] = useState(false);
  const [error, setError] = useState('');

  const questions = [...exam.questions].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentQuestion = questions[currentIndex] ?? null;
  const answeredCount = questions.filter((q) => answers[q.questionId] !== undefined).length;
  const unansweredQuestions = questions.filter((q) => answers[q.questionId] === undefined);
  const statusQuestions = showUnansweredOnly ? unansweredQuestions : questions;

  const getChoiceLabel = (question: QuestionItem) => {
    const selectedChoiceId = answers[question.questionId];
    if (selectedChoiceId === undefined) return '미응답';
    const choices = [...question.choices].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = choices.findIndex((c) => c.choiceId === selectedChoiceId);
    return idx >= 0 ? `${idx + 1}번` : '미응답';
  };

  const handleSubmit = async () => {
    const unansweredCount = questions.filter((q) => answers[q.questionId] === undefined).length;
    if (unansweredCount > 0) {
      const ok = confirm(`미응답 ${unansweredCount}문항이 있습니다. 그래도 제출하시겠습니까?`);
      if (!ok) return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await submitExam(exam.id, answers);
      setResult({ score: res.score, passed: res.passed });
      onResult(res.passed);
    } catch {
      setError('시험 제출에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-black/[0.06] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#185FA5] uppercase tracking-wide">최종 시험</p>
            <h2 className="text-sm font-black text-[#111]">{exam.title}</h2>
          </div>
          {!result && (
            <span className="text-xs text-gray-400">{answeredCount}/{questions.length} 답변</span>
          )}
        </div>

        <div className="px-6 py-4">
          {result ? (
            <div className="text-center py-6 flex flex-col items-center gap-3">
              <div className="text-5xl">{result.passed ? '🎉' : '😢'}</div>
              <p className="text-xl font-black text-[#185FA5]">{result.score}점</p>
              <p className={`text-sm font-bold ${result.passed ? 'text-emerald-600' : 'text-amber-600'}`}>
                {result.passed ? '합격! 이수 조건을 완료했습니다.' : `불합격 (합격 기준: ${exam.passScore}점)`}
              </p>
              {result.passed && (
                <p className="text-[11px] text-gray-400">재응시해도 이수 상태는 유지됩니다.</p>
              )}
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setAnswers({}); setResult(null); setCurrentIndex(0); setShowUnansweredOnly(false); }}
                  className="px-4 py-2 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b]">
                  다시 응시하기
                </button>
                <button onClick={onClose}
                  className="px-4 py-2 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50">
                  닫기
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-4">
              <div className="flex flex-col gap-4">
                {currentQuestion && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-bold text-gray-700">
                      <span className="text-[#185FA5] mr-1">Q{currentIndex + 1}.</span>{currentQuestion.questionText}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {[...currentQuestion.choices].sort((a, b) => a.sortOrder - b.sortOrder).map((c, ci) => {
                        const selected = answers[currentQuestion.questionId] === c.choiceId;
                        return (
                          <div key={c.choiceId}
                            onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.questionId]: c.choiceId }))}
                            className={`flex items-center gap-2.5 p-2.5 border rounded-lg cursor-pointer transition-all ${selected ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-bold shrink-0 ${selected ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-gray-300 text-gray-400'}`}>
                              {ci + 1}
                            </div>
                            <span className={`text-xs ${selected ? 'text-[#185FA5] font-bold' : 'text-gray-600'}`}>{c.choiceText}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-2">
                  {currentIndex > 0 ? (
                    <button type="button" onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
                      className="px-4 py-2 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50">
                      이전
                    </button>
                  ) : <span />}
                  {currentIndex < questions.length - 1 ? (
                    <button type="button" onClick={() => setCurrentIndex((p) => Math.min(questions.length - 1, p + 1))}
                      className="px-4 py-2 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b]">
                      다음
                    </button>
                  ) : (
                    <button type="button" onClick={handleSubmit} disabled={submitting}
                      className="px-4 py-2 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b] disabled:bg-gray-300">
                      {submitting ? '제출 중...' : '시험 제출'}
                    </button>
                  )}
                </div>
                {error && (
                  <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
                )}
              </div>

              <aside className="border border-black/[0.06] rounded-xl p-3 h-fit flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-[#111]">답안현황</h3>
                  <span className="text-[11px] text-gray-400">{answeredCount}/{questions.length}</span>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                  <input type="checkbox" checked={showUnansweredOnly}
                    onChange={(e) => setShowUnansweredOnly(e.target.checked)}
                    className="h-4 w-4 accent-[#185FA5]" />
                  미응답만 보기
                </label>
                <div className="flex flex-col gap-1.5">
                  {statusQuestions.length === 0 ? (
                    <div className="py-5 text-center text-xs text-gray-400">미응답 문항이 없습니다.</div>
                  ) : statusQuestions.map((question) => {
                    const index = questions.findIndex((q) => q.questionId === question.questionId);
                    const answered = answers[question.questionId] !== undefined;
                    const current = index === currentIndex;
                    return (
                      <button key={question.questionId} type="button"
                        onClick={() => setCurrentIndex(index)}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                          current ? 'border-[#185FA5] bg-[#E6F1FB]' : answered ? 'border-emerald-100 bg-emerald-50/70' : 'border-gray-200 bg-gray-50'
                        }`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                          current ? 'bg-[#185FA5] text-white' : answered ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}>
                          {index + 1}
                        </span>
                        <span className={`flex-1 text-xs font-bold ${current ? 'text-[#185FA5]' : answered ? 'text-emerald-700' : 'text-gray-500'}`}>
                          {getChoiceLabel(question)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
