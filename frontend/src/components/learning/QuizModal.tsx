'use client';
import { useState } from 'react';
import { submitQuiz } from '@/api/assessment';
import type { AssessmentResponse } from '@/api/types';

interface Props {
  quiz: AssessmentResponse;
  lectureId: number;
  /** passed=true: 통과, passed=false: 미통과 상태로 닫힘 */
  onClose: (passed: boolean) => void;
}

export function QuizModal({ quiz, lectureId: _lectureId, onClose }: Props) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await submitQuiz(quiz.id, answers);
      setResult({ score: res.score, passed: res.passed });
    } catch {
      setError('퀴즈 제출에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-black/[0.06] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#185FA5] uppercase tracking-wide">단원 퀴즈</p>
            <h2 className="text-sm font-black text-[#111]">{quiz.title}</h2>
          </div>
          {!result && (
            <span className="text-xs text-gray-400">{Object.keys(answers).length}/{quiz.questions.length} 답변</span>
          )}
        </div>

        <div className="px-6 py-4 flex flex-col gap-4">
          {result ? (
            <div className="text-center py-6 flex flex-col items-center gap-3">
              <div className="text-5xl">{result.passed ? '🎉' : '😢'}</div>
              <p className="text-xl font-black text-[#185FA5]">{result.score}점</p>
              <p className={`text-sm font-bold ${result.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                {result.passed ? '통과! 다음 강의로 이동하세요.' : `불통과 (합격 기준: ${quiz.passScore}점)`}
              </p>
              <div className="flex gap-2 mt-2">
                {!result.passed && (
                  <button onClick={() => { setAnswers({}); setResult(null); }}
                    className="px-4 py-2 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b]">
                    다시 풀기
                  </button>
                )}
                <button onClick={() => onClose(result.passed)}
                  className="px-4 py-2 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50">
                  닫기
                </button>
              </div>
            </div>
          ) : (
            <>
              {quiz.questions.map((q, qi) => (
                <div key={q.questionId} className="flex flex-col gap-2">
                  <p className="text-xs font-bold text-gray-700">
                    <span className="text-[#185FA5] mr-1">Q{qi + 1}.</span>{q.questionText}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {[...q.choices].sort((a, b) => a.sortOrder - b.sortOrder).map((c, ci) => {
                      const selected = answers[q.questionId] === c.choiceId;
                      return (
                        <button key={c.choiceId} type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.questionId]: c.choiceId }))}
                          className={`w-full flex items-center gap-2.5 p-2.5 border rounded-lg transition-all text-left ${selected ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-gray-200 hover:bg-gray-50'}`}>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-bold shrink-0 ${selected ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-gray-300 text-gray-400'}`}>
                            {ci + 1}
                          </div>
                          <span className={`text-xs ${selected ? 'text-[#185FA5] font-bold' : 'text-gray-600'}`}>{c.choiceText}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {error && (
                <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
              )}
              <button onClick={handleSubmit}
                disabled={submitting || Object.keys(answers).length < quiz.questions.length}
                className="w-full py-3 bg-[#185FA5] hover:bg-[#144f8b] disabled:bg-gray-300 text-white font-bold rounded-xl text-xs transition-all">
                {submitting ? '제출 중...' : `답안 제출 (${Object.keys(answers).length}/${quiz.questions.length})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
