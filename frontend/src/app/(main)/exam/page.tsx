'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMyCourses } from '@/api/myLearning';
import { getExam, submitExam, getMyExamAttempts } from '@/api/assessment';
import type { MyCourseResponse, AssessmentResponse, AttemptResponse } from '@/api/types';
import { getApiError } from '@/lib/utils';
import LoadingSpinner from '@/lib/LoadingSpinner';

function ExamContent() {
  const searchParams   = useSearchParams();
  const courseIdParam  = searchParams.get('courseId');

  const [myCourses,        setMyCourses]        = useState<MyCourseResponse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(
    courseIdParam ? Number(courseIdParam) : null,
  );
  const [exam,         setExam]         = useState<AssessmentResponse | null>(null);
  const [answers,      setAnswers]      = useState<Record<number, number>>({});
  const [result,       setResult]       = useState<AttemptResponse | null>(null);
  const [loadingExam,  setLoadingExam]  = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [attempts,     setAttempts]     = useState<AttemptResponse[]>([]);
  const [showHistory,  setShowHistory]  = useState(false);
  const [errorMsg,     setErrorMsg]     = useState('');

  useEffect(() => {
    getMyCourses(0, 100)
      .then((page) => {
        setMyCourses(page.content);
        if (!courseIdParam && page.content.length > 0) {
          setSelectedCourseId(page.content[0].courseId);
        }
      })
      .catch(() => setErrorMsg('수강 목록을 불러오지 못했습니다.'))
      .finally(() => setLoadingCourses(false));
  }, [courseIdParam]);

  useEffect(() => {
    if (!selectedCourseId) return;
    setExam(null); setResult(null); setAnswers({}); setAttempts([]); setShowHistory(false); setErrorMsg('');
    setLoadingExam(true);
    Promise.all([
      getExam(selectedCourseId).catch(() => null),
      getMyExamAttempts(selectedCourseId).catch(() => []),
    ])
      .then(([e, a]) => { setExam(e); setAttempts(a); })
      .finally(() => setLoadingExam(false));
  }, [selectedCourseId]);

  const handleSubmit = async () => {
    if (!exam) return;
    if (Object.keys(answers).length < exam.questions.length) {
      alert('모든 문항에 답변해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitExam(exam.id, answers);
      setResult(res);
      if (selectedCourseId) getMyExamAttempts(selectedCourseId).then(setAttempts).catch(() => {});
    } catch (err: unknown) {
      alert(getApiError(err) || '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCourses) return <LoadingSpinner />;

  // ── 결과 화면 ────────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="max-w-[720px] mx-auto flex flex-col gap-4">
        <div className={`bg-white border rounded-xl p-8 text-center shadow-sm ${result.passed ? 'border-emerald-200' : 'border-red-200'}`}>
          <div className="text-5xl mb-4">{result.passed ? '🎉' : '😢'}</div>
          <h2 className="text-xl font-black mb-2">{result.passed ? '합격!' : '불합격'}</h2>
          <p className="text-3xl font-black text-[#185FA5] mb-2">{result.score}점</p>
          <p className="text-xs text-gray-400">합격 기준: {exam?.passScore}점 이상</p>
          <button
            onClick={() => { setResult(null); setAnswers({}); }}
            className="mt-6 px-6 py-2.5 bg-[#185FA5] text-white text-xs font-bold rounded-xl hover:bg-[#144f8b] transition-colors"
          >
            {result.passed ? '확인' : '다시 응시하기'}
          </button>
        </div>

        {attempts.length > 0 && (
          <div className="bg-white border border-black/[0.06] rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 mb-3">📋 응시 이력 ({attempts.length}회)</h3>
            <div className="flex flex-col gap-2">
              {attempts.map((a, i) => (
                <div key={a.attemptId} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-[11px] text-gray-500">
                    {attempts.length - i}회차 · {new Date(a.attemptedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
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

  // ── 응시 화면 ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[720px] mx-auto flex flex-col gap-4">
      <h2 className="text-base font-black text-[#111]">최종 시험</h2>

      {/* 강좌 선택 */}
      <div className="bg-white border border-black/[0.06] rounded-xl p-4 shadow-sm">
        <label htmlFor="course-select" className="block text-xs font-semibold text-gray-500 mb-1.5">
          강좌 선택
        </label>
        <select
          id="course-select"
          value={selectedCourseId ?? ''}
          onChange={(e) => setSelectedCourseId(Number(e.target.value))}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#185FA5]"
        >
          <option value="" disabled>강좌를 선택하세요</option>
          {myCourses.map((c) => (
            <option key={c.courseId} value={c.courseId}>{c.courseTitle}</option>
          ))}
        </select>
      </div>

      {errorMsg && (
        <div className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{errorMsg}</div>
      )}

      {/* 로딩 */}
      {loadingExam && <LoadingSpinner text="시험 불러오는 중..." />}

      {/* 시험 없음 */}
      {!loadingExam && selectedCourseId && !exam && (
        <div className="bg-white border border-black/[0.06] rounded-xl p-8 text-center shadow-sm text-xs text-gray-400">
          해당 강좌에 시험이 없습니다.
        </div>
      )}

      {/* 응시 이력 토글 */}
      {!loadingExam && attempts.length > 0 && (
        <div className="bg-white border border-black/[0.06] rounded-xl p-4 shadow-sm">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-semibold text-[#185FA5] hover:underline"
          >
            📋 이전 응시 이력 {showHistory ? '접기' : `보기 (${attempts.length}회)`}
          </button>
          {showHistory && (
            <div className="mt-3 flex flex-col gap-2">
              {attempts.map((a, i) => (
                <div key={a.attemptId} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-[11px] text-gray-500">
                    {attempts.length - i}회차 · {new Date(a.attemptedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[#185FA5]">{a.score}점</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${a.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-400'}`}>
                      {a.passed ? '합격' : '불합격'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 시험 문제 */}
      {!loadingExam && exam && (
        <>
          <div className="bg-white border border-black/[0.06] rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-[#111]">{exam.title}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                총 {exam.questions.length}문항 · 합격 기준 {exam.passScore}점
              </p>
            </div>
            <span className="text-xs font-semibold text-[#185FA5] bg-blue-50 px-3 py-1 rounded-lg">
              {Object.keys(answers).length}/{exam.questions.length} 답변
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {exam.questions.map((q, qi) => (
              <div key={q.questionId} className="bg-white border border-black/[0.06] rounded-xl p-5 shadow-sm">
                <p className="text-sm font-semibold text-[#111] mb-3">
                  <span className="text-[#185FA5] mr-1">Q{qi + 1}.</span>
                  {q.questionText}
                  <span className="ml-1.5 text-[10px] text-gray-400 font-normal">({q.score}점)</span>
                </p>
                <div className="flex flex-col gap-2">
                  {q.choices.map((c) => {
                    const selected = answers[q.questionId] === c.choiceId;
                    return (
                      <button
                        key={c.choiceId}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.questionId]: c.choiceId }))}
                        className={`w-full text-left text-xs px-4 py-2.5 rounded-lg border transition-colors ${
                          selected
                            ? 'border-[#185FA5] bg-blue-50 text-[#185FA5] font-semibold'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-bold mr-2">{c.sortOrder}.</span>
                        {c.choiceText}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 bg-[#185FA5] hover:bg-[#144f8b] disabled:bg-gray-300 text-white text-sm font-bold rounded-xl transition-colors"
          >
            {submitting ? '제출 중...' : '시험 제출'}
          </button>
        </>
      )}
    </div>
  );
}

export default function ExamPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ExamContent />
    </Suspense>
  );
}
