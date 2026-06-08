'use client';
import { useState } from 'react';
import { submitFeedback } from '@/api/myLearning';
import type { FeedbackResponse } from '@/api/types';

interface Props {
  enrollmentId: number;
  onClose: () => void;
  onSubmitted: (feedback: FeedbackResponse) => void;
}

export function FeedbackModal({ enrollmentId, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await submitFeedback(enrollmentId, rating, comment);
      onSubmitted(res);
    } catch {
      setError('피드백 저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-black text-[#111]">강좌 수강 후기</h2>
          <p className="text-xs text-gray-400 mt-0.5">이 강좌가 도움이 됐나요? 솔직한 평가를 남겨주세요.</p>
        </div>
        <div className="flex gap-1.5 justify-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} onClick={() => setRating(star)}
              className={`text-3xl transition-transform hover:scale-110 ${star <= rating ? 'text-yellow-400' : 'text-gray-200'}`}>
              ★
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-center text-xs text-gray-500">
            {['', '매우 불만족', '불만족', '보통', '만족', '매우 만족'][rating]}
          </p>
        )}
        <textarea value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder="추가 의견을 자유롭게 작성해 주세요. (선택)"
          rows={3}
          className="w-full text-xs border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#185FA5] resize-none" />
        {error && (
          <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
        )}
        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={submitting || rating === 0}
            className="flex-1 py-2.5 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b] disabled:bg-gray-300">
            {submitting ? '저장 중...' : '후기 남기기'}
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 text-xs border border-gray-200 rounded-xl hover:bg-gray-50">
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
