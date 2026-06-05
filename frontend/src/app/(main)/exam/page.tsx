'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMyCourses } from '@/api/myLearning';
import { getExam, submitExam, getMyExamAttempts } from '@/api/assessment';
import type { MyCourseResponse, AssessmentResponse, AttemptResponse } from '@/api/types';

function ExamContent() {
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
      .catch(() => { })
      .finally(() => setLoadingCourses(false));
  }, [courseIdParam]);

  useEffect(() => {
    if (!selectedCourseId) return;

    setExam(null);
    setResult(null);
    setAnswers({});
    setAttempts([]);
    setShowHistory(false);

    setLoadingExam(true);

    Promise.all([
      getExam(selectedCourseId).catch(() => null),
      getMyExamAttempts(selectedCourseId).catch(() => []),
    ])
      .then(([e, a]) => {
        setExam(e);
        setAttempts(a);
      })
      .finally(() => setLoadingExam(false));
  }, [selectedCourseId]);

  const handleSubmit = async () => {
    if (!exam) return;

    setSubmitting(true);

    try {
      const res = await submitExam(exam.id, answers);

      setResult(res);

      if (selectedCourseId) {
        getMyExamAttempts(selectedCourseId)
          .then(setAttempts)
          .catch(() => { });
      }
    } catch (err: unknown) {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? '제출에 실패했습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCourses) {
    return (
      <div className="flex items-center justify-center py-20 text-xs text-gray-400">
        불러오는 중...
      </div>
    );
  }

  if (result) {
    return (
      <div className="max-w-[720px] mx-auto flex flex-col gap-4">
        <div
          className={`bg-white border rounded-xl p-8 text-center shadow-sm ${result.passed ? 'border-emerald-200' : 'border-red-200'
            }`}
        >
          <div className="text-5xl mb-4">
            {result.passed ? '🎉' : '😢'}
          </div>

          <h2 className="text-xl font-black mb-2">
            {result.passed ? '합격!' : '불합격'}
          </h2>

          <p className="text-3xl font-black text-[#185FA5] mb-2">
            {result.score}점
          </p>

          <p className="text-xs text-gray-400">
            합격 기준: {exam?.passScore}점 이상
          </p>

          <button
            onClick={() => {
              setResult(null);
              setAnswers({});
            }}
            className="mt-6 px-6 py-2.5 bg-[#185FA5] text-white text-xs font-bold rounded-xl hover:bg-[#144f8b] transition-colors"
          >
            {result.passed ? '확인' : '다시 응시하기'}
          </button>
        </div>

        {attempts.length > 0 && (
          <div className="bg-white border border-black/[0.06] rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 mb-3">
              📋 응시 이력 ({attempts.length}회)
            </h3>

            <div className="flex flex-col gap-2">
              {attempts.map((a, i) => (
                <div
                  key={a.attemptId}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <span className="text-[11px] text-gray-500">
                    {attempts.length - i}회차 ·{' '}
                    {new Date(a.attemptedAt).toLocaleString('ko-KR', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[#185FA5]">
                      {a.score}점
                    </span>

                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${a.passed
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-red-50 text-red-400'
                        }`}
                    >
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
      {/* 기존 return 이하 내용 그대로 유지 */}
    </div>
  );
}

export default function ExamPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-xs text-gray-400">
          불러오는 중...
        </div>
      }
    >
      <ExamContent />
    </Suspense>
  );
}