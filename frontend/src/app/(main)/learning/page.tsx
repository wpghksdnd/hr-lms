'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getMyCourses, getMyCourseDetail, startVideoWatch, endVideoWatch, submitFeedback, getFeedback } from '@/api/myLearning';
import { getQuiz, submitQuiz, getExam, submitExam } from '@/api/assessment';
import { createQuestion, getMyQuestions } from '@/api/qna';
import type { MyCourseResponse, MyCourseDetailResponse, MyCourseVideoStatus, AssessmentResponse, FeedbackResponse, QnaResponse, QuestionItem } from '@/api/types';

type Tracking = {
  playing: boolean;
  startedAtMs: number; // performance.now() at last play
  accSec: number;      // accumulated watched seconds this video session
  started: boolean;    // watch/start sent
};

function createTracking(): Tracking {
  return { playing: false, startedAtMs: 0, accSec: 0, started: false };
}

type VideoMode = 'blob' | 'youtube' | 'direct' | 'none';

function detectVideoMode(url?: string | null): VideoMode {
  if (!url) return 'none';
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (url.startsWith('/api/')) return 'blob';
  if (/^https?:\/\//.test(url)) return 'direct';
  return 'none';
}

function extractYoutubeId(url: string): string | null {
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) return shortMatch[1];
  return null;
}

// YT Player 타입 (간이)
type YTPlayer = {
  getCurrentTime: () => number;
  seekTo: (sec: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
};

function fmtSec(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function LearningPage() {
  const [myCourses, setMyCourses] = useState<MyCourseResponse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MyCourseDetailResponse | null>(null);
  const [currentVideo, setCurrentVideo] = useState<MyCourseVideoStatus | null>(null);

  const [blobUrl, setBlobUrl] = useState('');
  const [blobLoading, setBlobLoading] = useState(false);
  const [videoMode, setVideoMode] = useState<VideoMode>('none');
  const [statusMsg, setStatusMsg] = useState('');

  const [activeTab, setActiveTab] = useState<'note' | 'qa'>('note');
  const [noteText, setNoteText] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 단원 퀴즈 모달
  const [quizModal, setQuizModal] = useState<{ quiz: AssessmentResponse; lectureId: number } | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizRetryLectureId, setQuizRetryLectureId] = useState<number | null>(null);

  // 최종 시험 모달
  const [examModal, setExamModal] = useState<{ exam: AssessmentResponse } | null>(null);
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [examResult, setExamResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [examSubmitting, setExamSubmitting] = useState(false);
  const [examLoading, setExamLoading] = useState(false);
  const [examCurrentIndex, setExamCurrentIndex] = useState(0);
  const [examShowUnansweredOnly, setExamShowUnansweredOnly] = useState(false);

  // 피드백 모달
  const [feedbackModal, setFeedbackModal] = useState<{ enrollmentId: number } | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackDone, setFeedbackDone] = useState<FeedbackResponse | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackingRef = useRef<Tracking>(createTracking());
  const currentVideoRef = useRef<MyCourseVideoStatus | null>(null);

  // seek 방지용
  const highWaterMarkRef = useRef(0);                          // <video> 최대 도달 초
  const ytPlayerRef = useRef<YTPlayer | null>(null);          // YouTube Player 인스턴스
  const ytHighWaterMarkRef = useRef(0);                       // YouTube 최대 도달 초
  const ytIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // markCompleted / triggerQuiz를 ref로 보관 (initYTPlayer 내부에서 호출 시 선언 순서 문제 방지)
  const markCompletedRef = useRef<(id: number) => void>(() => {});
  const triggerQuizRef = useRef<(lectureId: number) => void>(() => {});

  // ── 강좌 목록 로드 ──────────────────────────────────────────
  useEffect(() => {
    getMyCourses(0, 20)
      .then((page) => {
        setMyCourses(page.content);
        if (page.content.length > 0) setSelectedCourseId(page.content[0].courseId);
      })
      .catch(() => {})
      .finally(() => setLoadingCourses(false));
  }, []);

  // ── 강좌 상세 로드 ───────────────────────────────────────────
  useEffect(() => {
    if (!selectedCourseId) return;
    setLoadingDetail(true);
    setFeedbackDone(null); setFeedbackModal(null);
    setQuizRetryLectureId(null);
    setQuizModal(null);
    setQuizResult(null);
    setQuizAnswers({});
    getMyCourseDetail(selectedCourseId)
      .then((d) => {
        setDetail(d);
        const sorted = [...(d.videos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
        setCurrentVideo(sorted[0] ?? null);
        // 이미 작성한 피드백 확인
        if (d.enrollmentId) getFeedback(d.enrollmentId).then(setFeedbackDone).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [selectedCourseId]);

  // ── 노트 불러오기 ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedCourseId) return;
    const saved = localStorage.getItem(`lms-note-${selectedCourseId}`);
    setNoteText(saved ?? '');
  }, [selectedCourseId]);

  // ── YouTube Seek 가드 ────────────────────────────────────────
  const stopYtGuard = useCallback(() => {
    if (ytIntervalRef.current) { clearInterval(ytIntervalRef.current); ytIntervalRef.current = null; }
  }, []);

  const startYtGuard = useCallback(() => {
    stopYtGuard();
    ytIntervalRef.current = setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player) return;
      try {
        const current = player.getCurrentTime();
        if (current > ytHighWaterMarkRef.current + 2) {
          // 2초 이상 앞으로 이동 시 되돌림
          player.seekTo(ytHighWaterMarkRef.current, true);
          setStatusMsg('⚠️ 앞으로 건너뛸 수 없습니다. 순서대로 시청해 주세요.');
        } else {
          ytHighWaterMarkRef.current = Math.max(ytHighWaterMarkRef.current, current);
        }
      } catch { /* player 아직 준비 안 됨 */ }
    }, 500);
  }, [stopYtGuard]);

  // ── YouTube Player 초기화 ────────────────────────────────────
  const initYTPlayer = useCallback((videoId: string, startSec: number) => {
    ytHighWaterMarkRef.current = startSec;
    const tracking = trackingRef.current;

    const createPlayer = () => {
      const YT = (window as { YT?: { Player?: new (...a: unknown[]) => YTPlayer; PlayerState?: Record<string, number> } }).YT;
      if (!YT?.Player) { setTimeout(createPlayer, 300); return; }

      // 기존 player 정리
      try { ytPlayerRef.current?.destroy(); } catch {}
      ytPlayerRef.current = null;

      const container = document.getElementById('yt-player-container');
      if (!container) { setTimeout(createPlayer, 300); return; }

      ytPlayerRef.current = new YT.Player('yt-player-container', {
        videoId,
        playerVars: { start: Math.floor(startSec), rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            setStatusMsg('영상을 재생하세요. 앞으로 건너뛰기는 제한됩니다.');
          },
          onStateChange: (e: { data: number }) => {
            const state = (window as { YT?: { PlayerState?: Record<string, number> } }).YT?.PlayerState;
            const video = currentVideoRef.current;

            if (e.data === (state?.PLAYING ?? 1)) {
              tracking.playing = true;
              tracking.startedAtMs = performance.now();
              if (!tracking.started && video) {
                tracking.started = true;
                startVideoWatch(video.videoId).catch(() => {});
                setStatusMsg('시청 시작이 기록되었습니다.');
              }
              startYtGuard();

            } else if (e.data === (state?.PAUSED ?? 2) || e.data === (state?.ENDED ?? 0)) {
              stopYtGuard();
              if (tracking.playing && tracking.startedAtMs > 0) {
                const elapsed = Math.floor((performance.now() - tracking.startedAtMs) / 1000);
                tracking.accSec += Math.max(0, elapsed);
                tracking.startedAtMs = 0;
                tracking.playing = false;
              }
              if (!video) return;
              endVideoWatch(video.videoId, tracking.accSec)
                .then((result) => {
                  const isEnded = e.data === (state?.ENDED ?? 0);
                  if (result.videoCompleted) {
                    markCompletedRef.current(video.videoId);
                    setStatusMsg('영상 시청 완료! 다음 강의를 수강할 수 있습니다.');
                    if (result.lectureCompleted) triggerQuizRef.current(video.lectureId);
                  } else {
                    setStatusMsg(isEnded ? `시청 종료 — ${tracking.accSec}초 기록됨` : `일시정지 — 시청 ${tracking.accSec}초 저장`);
                  }
                })
                .catch(() => {});
            }
          },
        },
      } as unknown as Record<string, unknown>);
    };

    const win = window as { YT?: { Player?: unknown }; onYouTubeIframeAPIReady?: () => void };
    if (win.YT?.Player) {
      createPlayer();
    } else {
      win.onYouTubeIframeAPIReady = createPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }
  }, [startYtGuard, stopYtGuard]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 비디오 로드 (URL 타입에 따라 분기) ──────────────────────
  useEffect(() => {
    currentVideoRef.current = currentVideo;
    trackingRef.current = createTracking();
    setBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return ''; });
    setBlobLoading(false);

    const url = currentVideo?.videoURL;
    const mode = detectVideoMode(url);
    setVideoMode(mode);

    if (mode === 'none') {
      setStatusMsg('강의를 선택하면 자동으로 영상이 로드됩니다.');
      return;
    }

    if (mode === 'youtube') {
      setStatusMsg('영상을 불러오는 중...');
      stopYtGuard();
      const videoId = extractYoutubeId(url ?? '');
      if (videoId) {
        const resumeSec = Math.max(0, currentVideo?.watchedSec ?? 0);
        // DOM이 마운트된 뒤 초기화
        setTimeout(() => initYTPlayer(videoId, resumeSec), 150);
      }
      return;
    }

    if (mode === 'direct') {
      setStatusMsg('영상을 재생하세요. 시청 시간은 자동으로 기록됩니다.');
      return;
    }

    // mode === 'blob': 로컬 스트리밍 API → blob fetch
    setBlobLoading(true);
    setStatusMsg('영상을 불러오는 중...');

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const abortCtrl = new AbortController();

    fetch(url!, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
      signal: abortCtrl.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        setBlobUrl(URL.createObjectURL(blob));
        setStatusMsg('영상 준비 완료. 재생하면 진도가 자동 기록됩니다.');
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setStatusMsg(`영상 로드 실패: ${(err as Error).message}`);
      })
      .finally(() => setBlobLoading(false));

    return () => {
      abortCtrl.abort();
      stopYtGuard();
    };
  }, [currentVideo?.videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 컴포넌트 언마운트 시 blob 해제 ───────────────────────────
  useEffect(() => {
    return () => { setBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return ''; }); };
  }, []);

  // ── 순차 잠금 ────────────────────────────────────────────────
  const sortedVideos = [...(detail?.videos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const canOpenVideo = (idx: number) => {
    if (idx <= 0) return true;
    return Boolean(sortedVideos[idx - 1]?.isCompleted);
  };

  // ── 완료 표시 업데이트 ───────────────────────────────────────
  const markCompleted = useCallback((videoId: number) => {
    setDetail((d) =>
      d
        ? { ...d, videos: d.videos.map((v) => v.videoId === videoId ? { ...v, isCompleted: true } : v) }
        : d,
    );
    setCurrentVideo((v) => (v?.videoId === videoId ? { ...v, isCompleted: true } : v));
  }, []);
  // ref 동기화 (initYTPlayer에서 선언 순서 없이 안전하게 접근)
  markCompletedRef.current = markCompleted;

  // ── 단원 퀴즈 트리거 ─────────────────────────────────────────
  const triggerQuiz = useCallback(async (lectureId: number) => {
    try {
      const quiz = await getQuiz(lectureId);
      if (quiz && quiz.questions.length > 0) {
        setQuizAnswers({});
        setQuizResult(null);
        setQuizRetryLectureId(null);
        setQuizModal({ quiz, lectureId });
      }
    } catch { /* 퀴즈 없으면 무시 */ }
  }, []);

  triggerQuizRef.current = triggerQuiz;

  const handleQuizSubmit = async () => {
    if (!quizModal) return;
    setQuizSubmitting(true);
    try {
      const result = await submitQuiz(quizModal.quiz.id, quizAnswers);
      setQuizResult({ score: result.score, passed: result.passed });
      if (result.passed && selectedCourseId) {
        setQuizRetryLectureId(null);
        getMyCourseDetail(selectedCourseId).then(setDetail).catch(() => {});
      } else {
        setQuizRetryLectureId(quizModal.lectureId);
      }
    } catch { alert('퀴즈 제출에 실패했습니다.'); }
    finally { setQuizSubmitting(false); }
  };

  const handleCloseQuizModal = () => {
    if (quizModal && !quizResult?.passed) {
      setQuizRetryLectureId(quizModal.lectureId);
    }
    setQuizModal(null);
  };

  const handleOpenExam = async () => {
    if (!selectedCourseId || !canTakeExam) return;
    setExamLoading(true);
    try {
      const exam = await getExam(selectedCourseId);
      setExamAnswers({});
      setExamResult(null);
      setExamCurrentIndex(0);
      setExamShowUnansweredOnly(false);
      setExamModal({ exam });
    } catch {
      alert('시험 정보를 불러오지 못했습니다.');
    } finally {
      setExamLoading(false);
    }
  };

  const handleExamSubmit = async () => {
    if (!examModal) return;

    const unansweredCount = examModal.exam.questions.filter((q) => examAnswers[q.questionId] === undefined).length;
    if (unansweredCount > 0) {
      const ok = confirm(`미응답 ${unansweredCount}문항이 있습니다. 그래도 제출하시겠습니까?`);
      if (!ok) return;
    }

    setExamSubmitting(true);
    try {
      const result = await submitExam(examModal.exam.id, examAnswers);
      setExamResult({ score: result.score, passed: result.passed });
      if (selectedCourseId) {
        getMyCourseDetail(selectedCourseId).then(setDetail).catch(() => {});
      }
    } catch {
      alert('시험 제출에 실패했습니다.');
    } finally {
      setExamSubmitting(false);
    }
  };

  // ── 비디오 이벤트 핸들러 ─────────────────────────────────────
  const handlePlay = useCallback(() => {
    const tracking = trackingRef.current;
    const video = currentVideoRef.current;
    tracking.playing = true;
    tracking.startedAtMs = performance.now();

    if (!tracking.started && video) {
      tracking.started = true;
      startVideoWatch(video.videoId).catch(() => {});
      setStatusMsg('시청 시작이 기록되었습니다.');
    }
  }, []);

  const flushWatchedSec = useCallback(() => {
    const tracking = trackingRef.current;
    if (tracking.playing && tracking.startedAtMs > 0) {
      const elapsed = Math.floor((performance.now() - tracking.startedAtMs) / 1000);
      tracking.accSec += Math.max(0, elapsed);
      tracking.startedAtMs = 0;
      tracking.playing = false;
    }
  }, []);

  const handlePause = useCallback(() => {
    flushWatchedSec();
    const video = currentVideoRef.current;
    if (!video) return;
    endVideoWatch(video.videoId, trackingRef.current.accSec)
      .then((result) => {
        setStatusMsg(`일시정지 — 시청 ${trackingRef.current.accSec}초 저장`);
        if (result.videoCompleted) {
          markCompleted(video.videoId);
          if (result.lectureCompleted) triggerQuiz(video.lectureId);
        }
      })
      .catch(() => {});
  }, [flushWatchedSec, markCompleted, triggerQuiz]);

  const handleEnded = useCallback(() => {
    flushWatchedSec();
    const video = currentVideoRef.current;
    if (!video) return;
    endVideoWatch(video.videoId, trackingRef.current.accSec)
      .then((result) => {
        if (result.videoCompleted) {
          markCompleted(video.videoId);
          setStatusMsg('영상 시청 완료! 다음 강의를 수강할 수 있습니다.');
          if (result.lectureCompleted) triggerQuiz(video.lectureId);
        } else {
          setStatusMsg(`시청 종료 — ${trackingRef.current.accSec}초 기록됨`);
        }
      })
      .catch(() => {});
  }, [flushWatchedSec, markCompleted, triggerQuiz]);

  const handleLoadedMetadata = useCallback(() => {
    const videoEl = videoRef.current;
    const video = currentVideoRef.current;
    if (!videoEl || !video) return;
    const resumeSec = Math.max(0, video.watchedSec ?? 0);
    highWaterMarkRef.current = resumeSec; // 지금까지 시청한 만큼은 이동 허용
    const duration = Math.floor(videoEl.duration || 0);
    if (resumeSec > 0 && duration > 0 && !video.isCompleted) {
      videoEl.currentTime = Math.min(resumeSec, duration - 1);
      setStatusMsg(`이전 시청 위치(${fmtSec(resumeSec)})부터 이어볼 수 있습니다.`);
    }
  }, []);

  // ── Seek 방지 (<video> 전용) ──────────────────────────────────
  const handleTimeUpdate = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    // 재생 중 도달한 최대 위치 업데이트
    if (!videoEl.paused) {
      highWaterMarkRef.current = Math.max(highWaterMarkRef.current, videoEl.currentTime);
    }
  }, []);

  const handleSeeking = useCallback(() => {
    const videoEl = videoRef.current;
    const video = currentVideoRef.current;
    if (!videoEl || video?.isCompleted) return; // 완료된 영상은 자유 탐색 허용
    const maxAllowed = highWaterMarkRef.current;
    if (videoEl.currentTime > maxAllowed + 1) {
      videoEl.currentTime = maxAllowed;
      setStatusMsg('⚠️ 앞으로 건너뛸 수 없습니다. 순서대로 시청해 주세요.');
    }
  }, []);

  // ── 다음 강의 이동 ───────────────────────────────────────────
  const currentIdx = sortedVideos.findIndex((v) => v.videoId === currentVideo?.videoId);
  const nextVideo = currentIdx >= 0 && currentIdx < sortedVideos.length - 1 ? sortedVideos[currentIdx + 1] : null;
  const canGoNext = nextVideo !== null && canOpenVideo(currentIdx + 1);
  const allVideosCompleted = sortedVideos.length > 0 && sortedVideos.every((v) => v.isCompleted);
  const allLecturesCompleted = (detail?.currentProgress ?? 0) >= 100 || detail?.currentStatus === 'DONE';
  const quizCompleted = detail?.quiz ? Boolean(detail.quiz.completed) : true;
  const learningCompleted = allLecturesCompleted || quizCompleted;
  const examPassed = Boolean(detail?.exam?.completed);
  const canTakeExam = allVideosCompleted && learningCompleted && !examPassed;
  const retryQuizVideo = quizRetryLectureId
    ? sortedVideos.find((video) => video.lectureId === quizRetryLectureId)
    : null;
  const canRetryQuiz = quizRetryLectureId !== null && !quizCompleted;
  const examQuestions = [...(examModal?.exam.questions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentExamQuestion = examQuestions[examCurrentIndex] ?? null;
  const examAnsweredCount = examQuestions.filter((q) => examAnswers[q.questionId] !== undefined).length;
  const examUnansweredQuestions = examQuestions.filter((q) => examAnswers[q.questionId] === undefined);
  const examStatusQuestions = examShowUnansweredOnly ? examUnansweredQuestions : examQuestions;

  const getExamChoiceLabel = (question: QuestionItem) => {
    const selectedChoiceId = examAnswers[question.questionId];
    if (selectedChoiceId === undefined) return '미응답';

    const choices = [...question.choices].sort((a, b) => a.sortOrder - b.sortOrder);
    const selectedIndex = choices.findIndex((choice) => choice.choiceId === selectedChoiceId);
    return selectedIndex >= 0 ? `${selectedIndex + 1}번` : '미응답';
  };

  const moveToExamQuestion = (questionId: number) => {
    const nextIndex = examQuestions.findIndex((q) => q.questionId === questionId);
    if (nextIndex >= 0) setExamCurrentIndex(nextIndex);
  };

  // ── 강의 선택 ────────────────────────────────────────────────
  const selectVideo = (video: MyCourseVideoStatus, idx: number) => {
    if (!canOpenVideo(idx)) return;
    setCurrentVideo(video);
  };

  if (loadingCourses) {
    return <div className="flex items-center justify-center py-20 text-xs text-gray-400">불러오는 중...</div>;
  }

  if (myCourses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <div className="text-4xl">📚</div>
        <div className="text-sm font-semibold text-gray-600">수강 중인 강좌가 없습니다.</div>
        <Link href="/courses" className="text-xs text-[#185FA5] font-semibold">수강신청 하러 가기 →</Link>
      </div>
    );
  }

  // ── 피드백 핸들러 ────────────────────────────────────────────
  const handleFeedbackSubmit = async () => {
    if (!feedbackModal || feedbackRating === 0) return;
    setFeedbackSubmitting(true);
    try {
      const res = await submitFeedback(feedbackModal.enrollmentId, feedbackRating, feedbackComment);
      setFeedbackDone(res);
      setFeedbackModal(null);
    } catch { alert('피드백 저장에 실패했습니다.'); }
    finally { setFeedbackSubmitting(false); }
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── 단원 퀴즈 모달 ── */}
      {quizModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-black/[0.06] flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-[#185FA5] uppercase tracking-wide">단원 퀴즈</p>
                <h2 className="text-sm font-black text-[#111]">{quizModal.quiz.title}</h2>
              </div>
              {!quizResult && (
                <span className="text-xs text-gray-400">{Object.keys(quizAnswers).length}/{quizModal.quiz.questions.length} 답변</span>
              )}
            </div>

            <div className="px-6 py-4 flex flex-col gap-4">
              {quizResult ? (
                // 결과 화면
                <div className="text-center py-6 flex flex-col items-center gap-3">
                  <div className="text-5xl">{quizResult.passed ? '🎉' : '😢'}</div>
                  <p className="text-xl font-black text-[#185FA5]">{quizResult.score}점</p>
                  <p className={`text-sm font-bold ${quizResult.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                    {quizResult.passed ? '통과! 다음 강의로 이동하세요.' : `불통과 (합격 기준: ${quizModal.quiz.passScore}점)`}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {!quizResult.passed && (
                      <button onClick={() => { setQuizAnswers({}); setQuizResult(null); }}
                        className="px-4 py-2 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b]">
                        다시 풀기
                      </button>
                    )}
                    <button onClick={handleCloseQuizModal}
                      className="px-4 py-2 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50">
                      닫기
                    </button>
                  </div>
                </div>
              ) : (
                // 문제 화면
                <>
                  {quizModal.quiz.questions.map((q, qi) => (
                    <div key={q.questionId} className="flex flex-col gap-2">
                      <p className="text-xs font-bold text-gray-700">
                        <span className="text-[#185FA5] mr-1">Q{qi + 1}.</span>{q.questionText}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {[...q.choices].sort((a, b) => a.sortOrder - b.sortOrder).map((c, ci) => {
                          const selected = quizAnswers[q.questionId] === c.choiceId;
                          return (
                            <div key={c.choiceId}
                              onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.questionId]: c.choiceId }))}
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
                  ))}
                  <button onClick={handleQuizSubmit}
                    disabled={quizSubmitting || Object.keys(quizAnswers).length < quizModal.quiz.questions.length}
                    className="w-full py-3 bg-[#185FA5] hover:bg-[#144f8b] disabled:bg-gray-300 text-white font-bold rounded-xl text-xs transition-all">
                    {quizSubmitting ? '제출 중...' : `답안 제출 (${Object.keys(quizAnswers).length}/${quizModal.quiz.questions.length})`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 최종 시험 모달 ── */}
      {examModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-black/[0.06] flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-[#185FA5] uppercase tracking-wide">최종 시험</p>
                <h2 className="text-sm font-black text-[#111]">{examModal.exam.title}</h2>
              </div>
              {!examResult && (
                <span className="text-xs text-gray-400">{examAnsweredCount}/{examQuestions.length} 답변</span>
              )}
            </div>

            <div className="px-6 py-4">
              {examResult ? (
                <div className="text-center py-6 flex flex-col items-center gap-3">
                  <div className="text-5xl">{examResult.passed ? '🎉' : '😢'}</div>
                  <p className="text-xl font-black text-[#185FA5]">{examResult.score}점</p>
                  <p className={`text-sm font-bold ${examResult.passed ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {examResult.passed ? '합격! 이수 조건을 완료했습니다.' : `불합격 (합격 기준: ${examModal.exam.passScore}점)`}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {!examResult.passed && (
                      <button onClick={() => { setExamAnswers({}); setExamResult(null); setExamCurrentIndex(0); setExamShowUnansweredOnly(false); }}
                        className="px-4 py-2 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b]">
                        다시 응시하기
                      </button>
                    )}
                    <button onClick={() => setExamModal(null)}
                      className="px-4 py-2 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50">
                      닫기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-4">
                  <div className="flex flex-col gap-4">
                    {currentExamQuestion && (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-bold text-gray-700">
                          <span className="text-[#185FA5] mr-1">Q{examCurrentIndex + 1}.</span>{currentExamQuestion.questionText}
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {[...currentExamQuestion.choices].sort((a, b) => a.sortOrder - b.sortOrder).map((c, ci) => {
                            const selected = examAnswers[currentExamQuestion.questionId] === c.choiceId;
                            return (
                              <div key={c.choiceId}
                                onClick={() => setExamAnswers((prev) => ({ ...prev, [currentExamQuestion.questionId]: c.choiceId }))}
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
                      {examCurrentIndex > 0 ? (
                        <button
                          type="button"
                          onClick={() => setExamCurrentIndex((prev) => Math.max(0, prev - 1))}
                          className="px-4 py-2 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50"
                        >
                          이전
                        </button>
                      ) : <span />}

                      {examCurrentIndex < examQuestions.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => setExamCurrentIndex((prev) => Math.min(examQuestions.length - 1, prev + 1))}
                          className="px-4 py-2 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b]"
                        >
                          다음
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleExamSubmit}
                          disabled={examSubmitting}
                          className="px-4 py-2 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b] disabled:bg-gray-300"
                        >
                          {examSubmitting ? '제출 중...' : '시험 제출'}
                        </button>
                      )}
                    </div>
                  </div>

                  <aside className="border border-black/[0.06] rounded-xl p-3 h-fit flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-[#111]">답안현황</h3>
                      <span className="text-[11px] text-gray-400">{examAnsweredCount}/{examQuestions.length}</span>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                      <input
                        type="checkbox"
                        checked={examShowUnansweredOnly}
                        onChange={(e) => setExamShowUnansweredOnly(e.target.checked)}
                        className="h-4 w-4 accent-[#185FA5]"
                      />
                      미응답만 보기
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {examStatusQuestions.length === 0 ? (
                        <div className="py-5 text-center text-xs text-gray-400">미응답 문항이 없습니다.</div>
                      ) : examStatusQuestions.map((question) => {
                        const index = examQuestions.findIndex((q) => q.questionId === question.questionId);
                        const answered = examAnswers[question.questionId] !== undefined;
                        const current = index === examCurrentIndex;

                        return (
                          <button
                            key={question.questionId}
                            type="button"
                            onClick={() => moveToExamQuestion(question.questionId)}
                            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                              current
                                ? 'border-[#185FA5] bg-[#E6F1FB]'
                                : answered
                                  ? 'border-emerald-100 bg-emerald-50/70'
                                  : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                              current
                                ? 'bg-[#185FA5] text-white'
                                : answered
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-gray-200 text-gray-500'
                            }`}>
                              {index + 1}
                            </span>
                            <span className={`flex-1 text-xs font-bold ${
                              current
                                ? 'text-[#185FA5]'
                                : answered
                                  ? 'text-emerald-700'
                                  : 'text-gray-500'
                            }`}>
                              {getExamChoiceLabel(question)}
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
      )}

      {/* ── 피드백 모달 ── */}
      {feedbackModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-black text-[#111]">강좌 수강 후기</h2>
              <p className="text-xs text-gray-400 mt-0.5">이 강좌가 도움이 됐나요? 솔직한 평가를 남겨주세요.</p>
            </div>
            {/* 별점 */}
            <div className="flex gap-1.5 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setFeedbackRating(star)}
                  className={`text-3xl transition-transform hover:scale-110 ${star <= feedbackRating ? 'text-yellow-400' : 'text-gray-200'}`}>
                  ★
                </button>
              ))}
            </div>
            {feedbackRating > 0 && (
              <p className="text-center text-xs text-gray-500">
                {['', '매우 불만족', '불만족', '보통', '만족', '매우 만족'][feedbackRating]}
              </p>
            )}
            <textarea value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="추가 의견을 자유롭게 작성해 주세요. (선택)"
              rows={3}
              className="w-full text-xs border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#185FA5] resize-none" />
            <div className="flex gap-2">
              <button onClick={handleFeedbackSubmit}
                disabled={feedbackSubmitting || feedbackRating === 0}
                className="flex-1 py-2.5 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b] disabled:bg-gray-300">
                {feedbackSubmitting ? '저장 중...' : '후기 남기기'}
              </button>
              <button onClick={() => setFeedbackModal(null)}
                className="px-4 py-2.5 text-xs border border-gray-200 rounded-xl hover:bg-gray-50">
                나중에
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 강좌 탭 */}
      {myCourses.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {myCourses.map((c) => (
            <button key={c.courseId} onClick={() => setSelectedCourseId(c.courseId)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                selectedCourseId === c.courseId
                  ? 'bg-[#185FA5] text-white border-[#185FA5]'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}>
              {c.courseTitle}
            </button>
          ))}
        </div>
      )}

      {loadingDetail ? (
        <div className="flex items-center justify-center py-20 text-xs text-gray-400">강좌 정보를 불러오는 중...</div>
      ) : (
        <div className="bg-white border border-black/[0.06] rounded-xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 p-4 sm:p-6">
            {/* 왼쪽: 플레이어 + 강의 목록 */}
            <div className="flex flex-col gap-4">

              {/* ── 비디오 플레이어 ── */}
              <div className="bg-[#111] rounded-xl overflow-hidden shadow-sm relative">
                {/* 로딩 스피너 (blob 모드) */}
                {blobLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 bg-[#111]">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span className="text-white/60 text-xs">영상 로드 중...</span>
                  </div>
                )}

                {/* YouTube IFrame Player API 컨테이너 */}
                {videoMode === 'youtube' && (
                  <div id="yt-player-container" className="w-full aspect-video block" />
                )}

                {/* 로컬 blob 영상 */}
                {videoMode === 'blob' && blobUrl && (
                  <video
                    ref={videoRef}
                    className="w-full aspect-video block bg-[#111]"
                    controls
                    src={blobUrl}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onEnded={handleEnded}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onSeeking={handleSeeking}
                  />
                )}

                {/* 외부 직접 재생 (일반 MP4 등) */}
                {videoMode === 'direct' && currentVideo?.videoURL && (
                  <video
                    ref={videoRef}
                    className="w-full aspect-video block bg-[#111]"
                    controls
                    src={currentVideo.videoURL}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onEnded={handleEnded}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onSeeking={handleSeeking}
                  />
                )}

                {/* 빈 상태 */}
                {videoMode === 'none' && !blobLoading && (
                  <div className="w-full aspect-video flex flex-col items-center justify-center gap-3">
                    <div className="text-white/30 text-4xl">▶</div>
                    <div className="text-white/40 text-xs">강의를 선택하세요</div>
                  </div>
                )}

                {/* 완료 뱃지 */}
                {currentVideo?.isCompleted && (
                  <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-20">
                    ✓ 완료
                  </div>
                )}
              </div>

              {/* 영상 정보 + 상태 */}
              <div className="flex items-start justify-between gap-3 px-1">
                <div>
                  <div className="font-semibold text-[#111]">
                    {detail?.courseTitle} {currentVideo ? `— ${currentVideo.title}` : ''}
                  </div>
                  {currentVideo && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      재생시간 {fmtSec(currentVideo.durationSec)}
                      {currentVideo.watchedSec > 0 && ` · 이전 시청 ${fmtSec(currentVideo.watchedSec)}`}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* 외부 직접 영상 (direct)은 수동 완료 버튼 제공, YouTube는 IFrame API가 자동 처리 */}
                  {videoMode === 'direct' && currentVideo && !currentVideo.isCompleted && (
                    <button
                      className="text-[11px] px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors"
                      onClick={() => {
                        endVideoWatch(currentVideo.videoId, currentVideo.durationSec)
                          .then((result) => {
                            if (result.videoCompleted) {
                              markCompleted(currentVideo.videoId);
                              setStatusMsg('시청 완료로 표시했습니다.');
                            }
                          })
                          .catch(() => setStatusMsg('완료 처리에 실패했습니다.'));
                      }}
                    >
                      ✓ 시청 완료 표시
                    </button>
                  )}
                  <div className="text-[11px] text-[#185FA5] font-semibold">
                    전체 {detail?.currentProgress ?? 0}% 완료
                  </div>
                </div>
              </div>
              {statusMsg && (
                <div className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-black/[0.05]">
                  {statusMsg}
                </div>
              )}

              {canRetryQuiz && quizRetryLectureId && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-amber-700">퀴즈 다시풀기 필요</span>
                    <span className="text-xs text-amber-700/80">
                      {retryQuizVideo?.title ?? '현재 단원'} 퀴즈를 통과해야 다음 단계로 진행할 수 있습니다.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerQuiz(quizRetryLectureId)}
                    className="shrink-0 px-4 py-2 bg-[#185FA5] hover:bg-[#144f8b] text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    퀴즈 다시풀기
                  </button>
                </div>
              )}

              {/* 다음 강의로 넘어가기 */}
              {nextVideo && (
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  canGoNext
                    ? 'bg-[#E6F1FB] border-[#185FA5]/30'
                    : 'bg-gray-50 border-gray-100 opacity-60'
                }`}>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-gray-400 font-medium">다음 강의</span>
                    <span className={`text-sm font-semibold ${canGoNext ? 'text-[#185FA5]' : 'text-gray-400'}`}>
                      {currentIdx + 2}강. {nextVideo.title}
                    </span>
                    {!canGoNext && (
                      <span className="text-[11px] text-gray-400 mt-0.5">현재 강의를 완료하면 수강할 수 있습니다.</span>
                    )}
                  </div>
                  <button
                    disabled={!canGoNext}
                    onClick={() => canGoNext && setCurrentVideo(nextVideo)}
                    className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      canGoNext
                        ? 'bg-[#185FA5] text-white hover:bg-[#144f8b]'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    다음 강의로 →
                  </button>
                </div>
              )}

              {/* 모든 강의 완료 */}
              {allVideosCompleted && (
                <div className="flex flex-col gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🎉</span>
                      <div>
                        <div className="text-sm font-bold text-emerald-700">모든 강의를 완료했습니다!</div>
                        <div className="text-[11px] text-emerald-600">
                          {examPassed
                            ? '최종 시험에 합격했습니다.'
                            : quizCompleted
                              ? '최종 시험에 도전해 이수를 완료하세요.'
                              : '퀴즈 합격 후 최종 시험에 응시할 수 있습니다.'}
                        </div>
                      </div>
                    </div>
                    {canTakeExam ? (
                      <button
                        type="button"
                        onClick={handleOpenExam}
                        disabled={examLoading}
                        className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        {examLoading ? '시험 불러오는 중...' : '시험 응시하기 →'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="shrink-0 px-4 py-2 bg-gray-200 text-gray-400 text-xs font-bold rounded-lg cursor-not-allowed"
                      >
                        {examPassed ? '시험 합격 완료' : '시험 응시하기'}
                      </button>
                    )}
                  </div>
                  {/* 피드백 — 수강 완료(DONE) 상태일 때만 표시 */}
                  {detail?.currentStatus === 'DONE' && (
                    feedbackDone ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
                        <span>{'★'.repeat(feedbackDone.rating)}{'☆'.repeat(5 - feedbackDone.rating)}</span>
                        <span>후기를 남겨주셨습니다. 감사합니다!</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setFeedbackModal({ enrollmentId: detail.enrollmentId })}
                        className="self-start text-[11px] text-emerald-700 font-semibold underline underline-offset-2 hover:text-emerald-900"
                      >
                        ⭐ 강좌 후기 남기기
                      </button>
                    )
                  )}
                </div>
              )}

              {/* 강의 목록 */}
              <div className="bg-white border border-black/[0.06] rounded-xl p-4 shadow-sm">
                <h3 className="font-bold text-[#111] mb-3">강의 목록 ({sortedVideos.length}강)</h3>
                <div className="flex flex-col gap-1.5">
                  {sortedVideos.map((video, idx) => {
                    const isSelected = video.videoId === currentVideo?.videoId;
                    const isLocked = !canOpenVideo(idx);
                    return (
                      <div key={video.videoId}
                        onClick={() => selectVideo(video, idx)}
                        title={isLocked ? '이전 강의를 완료해야 시청할 수 있습니다.' : undefined}
                        className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                          isLocked
                            ? 'opacity-50 cursor-not-allowed bg-gray-50'
                            : isSelected
                              ? 'bg-[#E6F1FB] border-l-4 border-[#185FA5] cursor-pointer'
                              : 'hover:bg-gray-50 cursor-pointer'
                        }`}>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold w-5 text-center ${isSelected ? 'text-[#185FA5]' : 'text-gray-400'}`}>
                            {isLocked ? '🔒' : idx + 1}
                          </span>
                          <span className={`text-xs sm:text-sm ${isSelected ? 'font-bold text-[#185FA5]' : 'text-gray-700'}`}>
                            {video.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-gray-400">{fmtSec(video.durationSec)}</span>
                          {video.isCompleted
                            ? <span className="text-emerald-600 text-xs font-bold">✓ 완료</span>
                            : video.watchedSec > 0
                              ? <span className="text-[11px] text-gray-400">{fmtSec(video.watchedSec)}</span>
                              : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 오른쪽: 노트 / Q&A */}
            <div className="bg-white border border-black/[0.06] rounded-xl p-4 shadow-sm flex flex-col gap-4 h-fit">
              <div className="flex gap-1.5 border-b border-gray-100 pb-2">
                {(['note', 'qa'] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      activeTab === tab ? 'bg-[#185FA5] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}>
                    {tab === 'note' ? '📝 학습 노트' : '❓ Q&A'}
                  </button>
                ))}
              </div>

              {activeTab === 'note' ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] text-gray-400">강의를 들으며 중요한 내용을 메모하세요.</p>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="여기에 노트를 필기하세요..."
                    className="w-full h-48 p-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#185FA5] resize-none bg-gray-50/30"
                  />
                  <button
                    className="w-full py-2 bg-gray-900 text-white font-bold text-xs rounded-lg hover:bg-black transition-colors"
                    onClick={() => {
                      if (selectedCourseId) {
                        localStorage.setItem(`lms-note-${selectedCourseId}`, noteText);
                        setStatusMsg('학습 노트가 저장되었습니다.');
                      }
                    }}
                  >
                    노트 저장하기
                  </button>
                </div>
              ) : (
                <QnaPanel courseId={selectedCourseId} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QnaPanel({ courseId }: { courseId: number | null }) {
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
