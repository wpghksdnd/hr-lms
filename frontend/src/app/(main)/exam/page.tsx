'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMyCourses } from '@/api/myLearning';
import { getExam, submitExam, getMyExamAttempts } from '@/api/assessment';
import type { AssessmentResponse, AttemptResponse, MyCourseResponse, QuestionItem } from '@/api/types';
import { getApiError } from '@/lib/utils';
import LoadingSpinner from '@/lib/LoadingSpinner';

function ExamContent() {
  const searchParams  = useSearchParams();
  const courseIdParam = searchParams.get('courseId');

  const [myCourses,        setMyCourses]        = useState<MyCourseResponse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(
    courseIdParam ? Number(courseIdParam) : null,
  );
  const [exam,              setExam]              = useState<AssessmentResponse | null>(null);
  const [answers,           setAnswers]           = useState<Record<number, number>>({});
  const [result,            setResult]            = useState<AttemptResponse | null>(null);
  const [attempts,          setAttempts]          = useState<AttemptResponse[]>([]);
  const [currentIndex,      setCurrentIndex]      = useState(0);
  const [showHistory,       setShowHistory]       = useState(false);
  const [showUnansweredOnly, setShowUnansweredOnly] = useState(false);
  const [loadingCourses,    setLoadingCourses]    = useState(true);
  const [loadingExam,       setLoadingExam]       = useState(false);
  const [submitting,        setSubmitting]        = useState(false);
  const [errorMsg,          setErrorMsg]          = useState('');

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

    setExam(null);
    setResult(null);
    setAnswers({});
    setAttempts([]);
    setCurrentIndex(0);
    setShowHistory(false);
    setShowUnansweredOnly(false);
    setErrorMsg('');
    setLoadingExam(true);

    Promise.all([
      getExam(selectedCourseId).catch(() => null),
      getMyExamAttempts(selectedCourseId).catch(() => []),
    ])
      .then(([examData, attemptList]) => {
        setExam(examData);
        setAttempts(attemptList);
      })
      .finally(() => setLoadingExam(false));
  }, [selectedCourseId]);

  const questions = useMemo(
    () => [...(exam?.questions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [exam],
  );
  const currentQuestion    = questions[currentIndex] ?? null;
  const answeredCount      = questions.filter((q) => answers[q.questionId] !== undefined).length;
  const unansweredQuestions = questions.filter((q) => answers[q.questionId] === undefined);
  const statusQuestions    = showUnansweredOnly ? unansweredQuestions : questions;
  const hasPassed          = attempts.some((a) => a.passed);

  const getChoiceLabel = (question: QuestionItem) => {
    const selectedChoiceId = answers[question.questionId];
    if (selectedChoiceId === undefined) return '미응답';
    const choices = [...question.choices].sort((a, b) => a.sortOrder - b.sortOrder);
    const selectedIndex = choices.findIndex((c) => c.choiceId === selectedChoiceId);
    return selectedIndex >= 0 ? `${selectedIndex + 1}번` : '미응답';
  };

  const handleSelectAnswer = (questionId: number, choiceId: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
  };

  const moveToQuestion = (questionId: number) => {
    const nextIndex = questions.findIndex((q) => q.questionId === questionId);
    if (nextIndex >= 0) setCurrentIndex(nextIndex);
  };

  const handleSubmit = async () => {
    if (!exam || submitting) return;

    if (unansweredQuestions.length > 0) {
      const ok = confirm(`미응답 ${unansweredQuestions.length}문항이 있습니다. 그래도 제출하시겠습니까?`);
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      const res = await submitExam(exam.id, answers);
      setResult(res);
      if (selectedCourseId) {
        getMyExamAttempts(selectedCourseId).then(setAttempts).catch(() => {});
      }
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
        <div className={`bg-white border rounded-xl p-8 text-center shadow-sm ${result.passed ? 'border-emerald-200' : 'border-amber-200'}`}>
          <div className="text-5xl mb-4">{result.passed ? '🎉' : '😢'}</div>
          <h2 className="text-xl font-black mb-2">{result.passed ? '합격!' : '불합격'}</h2>
          <p className="text-3xl font-black text-[#185FA5] mb-2">{result.score}점</p>
          <p className="text-xs text-gray-400">합격 기준: {exam?.passScore}점 이상</p>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setAnswers({});
              setCurrentIndex(0);
            }}
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
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${a.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
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
    <div className="max-w-[1040px] mx-auto flex flex-col gap-4">
      <div className="bg-white border border-black/[0.06] rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold text-[#185FA5] uppercase tracking-wide">Final Exam</p>
            <h1 className="text-lg font-black text-[#111]">시험 응시</h1>
          </div>
          {attempts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              className="px-3 py-2 text-xs font-bold border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              응시 이력 {showHistory ? '접기' : '보기'}
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{errorMsg}</div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-gray-500">수강 강좌</span>
          <select
            value={selectedCourseId ?? ''}
            onChange={(e) => setSelectedCourseId(Number(e.target.value))}
            className="h-10 border border-gray-200 rounded-lg px-3 text-sm outline-none focus:border-[#185FA5]"
          >
            {myCourses.map((course) => (
              <option key={course.courseId} value={course.courseId}>
                {course.courseTitle}
              </option>
            ))}
          </select>
        </label>

        {showHistory && attempts.length > 0 && (
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
            {attempts.map((attempt, index) => (
              <div key={attempt.attemptId} className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-gray-500">
                  {attempts.length - index}회차 · {new Date(attempt.attemptedAt).toLocaleString('ko-KR')}
                </span>
                <span className={`text-xs font-bold ${attempt.passed ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {attempt.score}점 · {attempt.passed ? '합격' : '불합격'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loadingExam ? (
        <LoadingSpinner text="시험 불러오는 중..." />
      ) : !selectedCourseId ? (
        <div className="bg-white border border-black/[0.06] rounded-xl p-8 text-center text-xs text-gray-400">
          응시할 강좌를 선택해 주세요.
        </div>
      ) : !exam ? (
        <div className="bg-white border border-black/[0.06] rounded-xl p-8 text-center text-xs text-gray-400">
          해당 강좌에 시험이 없습니다.
        </div>
      ) : hasPassed ? (
        <div className="bg-white border border-emerald-100 rounded-xl p-8 text-center shadow-sm">
          <div className="text-sm font-black text-emerald-700">이미 합격한 시험입니다.</div>
          <p className="text-xs text-gray-400 mt-2">응시 이력에서 결과를 확인하실 수 있습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4">
          {/* 문제 영역 */}
          <section className="bg-white border border-black/[0.06] rounded-xl p-5 shadow-sm flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4 border-b border-black/[0.06] pb-4">
              <div>
                <p className="text-[10px] font-bold text-[#185FA5] uppercase tracking-wide">시험</p>
                <h2 className="text-base font-black text-[#111]">{exam.title}</h2>
                <p className="text-xs text-gray-400 mt-1">
                  합격 기준 {exam.passScore}점 · 총 {questions.length}문항
                </p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {answeredCount}/{questions.length} 답변
              </span>
            </div>

            {currentQuestion && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-gray-700">
                    <span className="text-[#185FA5] mr-1">Q{currentIndex + 1}.</span>
                    {currentQuestion.questionText}
                    <span className="ml-1.5 text-[10px] text-gray-400 font-normal">({currentQuestion.score}점)</span>
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {[...currentQuestion.choices].sort((a, b) => a.sortOrder - b.sortOrder).map((choice, choiceIndex) => {
                      const selected = answers[currentQuestion.questionId] === choice.choiceId;
                      return (
                        <button
                          key={choice.choiceId}
                          type="button"
                          onClick={() => handleSelectAnswer(currentQuestion.questionId, choice.choiceId)}
                          className={`flex items-center gap-2.5 p-2.5 border rounded-lg cursor-pointer transition-all text-left ${
                            selected
                              ? 'border-[#185FA5] bg-[#E6F1FB]'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            selected
                              ? 'bg-[#185FA5] text-white border-[#185FA5]'
                              : 'border-gray-300 text-gray-400'
                          }`}>
                            {choiceIndex + 1}
                          </span>
                          <span className={`text-xs ${selected ? 'text-[#185FA5] font-bold' : 'text-gray-600'}`}>
                            {choice.choiceText}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  {currentIndex > 0 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      className="px-4 py-2 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50"
                    >
                      이전
                    </button>
                  ) : <span />}

                  {currentIndex < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                      className="px-4 py-2 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b]"
                    >
                      다음
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="px-4 py-2 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b] disabled:bg-gray-300"
                    >
                      {submitting ? '제출 중...' : '시험 제출'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* 사이드 답변 현황 */}
          <aside className="bg-white border border-black/[0.06] rounded-xl p-4 shadow-sm h-fit flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[#111]">답변현황</h3>
              <span className="text-[11px] text-gray-400">{answeredCount}/{questions.length}</span>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={showUnansweredOnly}
                onChange={(e) => setShowUnansweredOnly(e.target.checked)}
                className="h-4 w-4 accent-[#185FA5]"
              />
              미응답만 보기
            </label>

            <div className="flex flex-col gap-1.5">
              {statusQuestions.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">미응답 문항이 없습니다.</div>
              ) : (
                statusQuestions.map((question) => {
                  const index   = questions.findIndex((q) => q.questionId === question.questionId);
                  const answered = answers[question.questionId] !== undefined;
                  const current  = index === currentIndex;

                  return (
                    <button
                      key={question.questionId}
                      type="button"
                      onClick={() => moveToQuestion(question.questionId)}
                      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                        current
                          ? 'border-[#185FA5] bg-[#E6F1FB]'
                          : answered
                            ? 'border-emerald-100 bg-emerald-50/70'
                            : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                        current
                          ? 'bg-[#185FA5] text-white'
                          : answered
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-200 text-gray-500'
                      }`}>
                        {index + 1}
                      </span>
                      <span className={`flex-1 text-xs font-bold truncate ${
                        current
                          ? 'text-[#185FA5]'
                          : answered
                            ? 'text-emerald-700'
                            : 'text-gray-500'
                      }`}>
                        {getChoiceLabel(question)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* 최하단 제출 버튼 (전체 문항 보기 시 편의용) */}
            {!showUnansweredOnly && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-2.5 bg-[#185FA5] hover:bg-[#144f8b] disabled:bg-gray-300 text-white text-xs font-bold rounded-xl transition-colors mt-1"
              >
                {submitting ? '제출 중...' : '시험 제출'}
              </button>
            )}
          </aside>
        </div>
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
