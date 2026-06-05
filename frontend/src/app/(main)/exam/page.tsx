'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMyCourses } from '@/api/myLearning';
import { getExam, submitExam, getMyExamAttempts } from '@/api/assessment';
import type { MyCourseResponse, AssessmentResponse, AttemptResponse } from '@/api/types';

export default function ExamPage() {
  const searchParams = useSearchParams();
  const courseIdParam = searchParams.get('courseId');
  const [myCourses, setMyCourses] = useState<MyCourseResponse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(
    courseIdParam ? Number(courseIdParam) : null,
  );
  const [exam, setExam] = useState<AssessmentResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<AttemptResponse | null>(null);
  const [loadingExam, setLoadingExam] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [attempts, setAttempts] = useState<AttemptResponse[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    getMyCourses(0, 20)
      .then((page) => {
        setMyCourses(page.content);
        if (!courseIdParam && page.content.length > 0) {
          setSelectedCourseId(page.content[0].courseId);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCourses(false));
  }, [courseIdParam]);

  useEffect(() => {
    if (!selectedCourseId) return;
    setExam(null); setResult(null); setAnswers({}); setAttempts([]); setShowHistory(false);
    setLoadingExam(true);
    Promise.all([
      getExam(selectedCourseId).catch(() => null),
      getMyExamAttempts(selectedCourseId).catch(() => []),
    ]).then(([e, a]) => {
      setExam(e);
      setAttempts(a);
    }).finally(() => setLoadingExam(false));
  }, [selectedCourseId]);

  const handleSubmit = async () => {
    if (!exam) return;
    setSubmitting(true);
    try {
      const res = await submitExam(exam.id, answers);
      setResult(res);
      // 결과 후 이력 갱신
      if (selectedCourseId) {
        getMyExamAttempts(selectedCourseId).then(setAttempts).catch(() => {});
      }
    } catch (err: unknown) {
      alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCourses) return <div className="flex items-center justify-center py-20 text-xs text-gray-400">불러오는 중...</div>;

  if (result) {
    return (
      <div className="max-w-[720px] mx-auto flex flex-col gap-4">
        <div className={`bg-white border rounded-xl p-8 text-center shadow-sm ${result.passed ? 'border-emerald-200' : 'border-red-200'}`}>
          <div className="text-5xl mb-4">{result.passed ? '🎉' : '😢'}</div>
          <h2 className="text-xl font-black mb-2">{result.passed ? '합격!' : '불합격'}</h2>
          <p className="text-3xl font-black text-[#185FA5] mb-2">{result.score}점</p>
          <p className="text-xs text-gray-400">합격 기준: {exam?.passScore}점 이상</p>
          <button onClick={() => { setResult(null); setAnswers({}); }}
            className="mt-6 px-6 py-2.5 bg-[#185FA5] text-white text-xs font-bold rounded-xl hover:bg-[#144f8b] transition-colors">
            {result.passed ? '확인' : '다시 응시하기'}
          </button>
        </div>

        {/* 응시 이력 */}
        {attempts.length > 0 && (
          <div className="bg-white border border-black/[0.06] rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 mb-3">📋 응시 이력 ({attempts.length}회)</h3>
            <div className="flex flex-col gap-2">
              {attempts.map((a, i) => (
                <div key={a.attemptId} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-[11px] text-gray-500">{attempts.length - i}회차 · {new Date(a.attemptedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[#185FA5]">{a.score}점</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${a.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-400'}`}>
                      {a.passed ? '합격' : '불합격'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto flex flex-col gap-4">
      {myCourses.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {myCourses.map((c) => (
            <button key={c.courseId} onClick={() => setSelectedCourseId(c.courseId)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${selectedCourseId === c.courseId ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'bg-white text-gray-600 border-gray-200'}`}>
              {c.courseTitle}
            </button>
          ))}
        </div>
      )}

      {loadingExam ? (
        <div className="flex items-center justify-center py-20 text-xs text-gray-400">시험 정보를 불러오는 중...</div>
      ) : !exam ? (
        <div className="bg-white border border-black/[0.06] rounded-xl p-8 text-center text-gray-400">
          해당 강좌의 시험이 없습니다.
        </div>
      ) : (
        <>
          <div className="bg-white border border-black/[0.06] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-bold text-[#111] mb-1">{exam.title}</div>
                <div className="text-xs text-[#888]">총 {exam.questions.length}문항 · {exam.passScore}점 이상 합격</div>
              </div>
              {attempts.length > 0 && (
                <button onClick={() => setShowHistory((v) => !v)}
                  className="text-[11px] text-[#185FA5] font-semibold hover:underline shrink-0">
                  응시 이력 {attempts.length}회 {showHistory ? '▲' : '▼'}
                </button>
              )}
            </div>

            {/* 응시 이력 인라인 */}
            {showHistory && attempts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-1.5">
                {attempts.map((a, i) => (
                  <div key={a.attemptId} className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">
                      {attempts.length - i}회차 · {new Date(a.attemptedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#185FA5]">{a.score}점</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${a.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-400'}`}>
                        {a.passed ? '합격' : '불합격'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {exam.questions.map((q, qIdx) => (
            <div key={q.questionId} className="bg-white border border-black/[0.06] rounded-xl p-6 shadow-sm">
              <div className="text-xs font-bold text-[#185FA5] mb-2">문제 {qIdx + 1} / {exam.questions.length}</div>
              <div className="text-[15px] font-bold text-[#111] mb-5 leading-relaxed">{q.questionText}</div>
              <div className="flex flex-col gap-2.5">
                {q.choices.map((choice) => {
                  const isSelected = answers[q.questionId] === choice.choiceId;
                  return (
                    <div key={choice.choiceId} onClick={() => setAnswers((prev) => ({ ...prev, [q.questionId]: choice.choiceId }))}
                      className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${isSelected ? 'border-[#185FA5] bg-[#E6F1FB] ring-1 ring-[#185FA5]' : 'border-black/[0.1] hover:bg-gray-50'}`}>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 ${isSelected ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'bg-white text-[#888] border-black/[0.2]'}`}>
                        {choice.sortOrder}
                      </div>
                      <div className={`text-[13px] ${isSelected ? 'text-[#185FA5] font-bold' : 'text-[#444]'}`}>{choice.choiceText}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button onClick={handleSubmit} disabled={submitting || Object.keys(answers).length < exam.questions.length}
            className="w-full py-3.5 bg-[#185FA5] hover:bg-[#144f8b] disabled:bg-gray-300 text-white font-bold rounded-xl shadow-md transition-all text-xs sm:text-sm">
            {submitting ? '제출 중...' : `답안 제출 (${Object.keys(answers).length}/${exam.questions.length})`}
          </button>
        </>
      )}
    </div>
  );
}
