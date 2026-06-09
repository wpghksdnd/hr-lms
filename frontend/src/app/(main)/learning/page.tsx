'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getMyCourses, getMyCourseDetail, startVideoWatch, endVideoWatch, getFeedback } from '@/api/myLearning';
import { getQuiz, getExam } from '@/api/assessment';
import type { MyCourseResponse, MyCourseDetailResponse, MyCourseVideoStatus, AssessmentResponse, FeedbackResponse } from '@/api/types';
import { fmtSec } from '@/lib/utils';
import { QuizModal } from '@/components/learning/QuizModal';
import { ExamModal } from '@/components/learning/ExamModal';
import { FeedbackModal } from '@/components/learning/FeedbackModal';
import { QnaPanel } from '@/components/learning/QnaPanel';

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

function getInitialCourseIdFromUrl() {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('courseId');
  const courseId = raw ? Number(raw) : NaN;
  return Number.isFinite(courseId) && courseId > 0 ? courseId : null;
}

type ApiErrorLike = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
  message?: string;
};

function getApiErrorDetail(error: unknown) {
  const err = error as ApiErrorLike;
  const status = err.response?.status;
  const message = err.response?.data?.message ?? err.response?.data?.error ?? err.message;
  return [status ? `HTTP ${status}` : null, message].filter(Boolean).join(' - ');
}

function sortVideos(videos: MyCourseVideoStatus[]) {
  return [...videos].sort(
    (a, b) =>
      (a.lectureSortOrder ?? 0) - (b.lectureSortOrder ?? 0) ||
      a.sortOrder - b.sortOrder,
  );
}

// YT Player 타입 (간이)
type YTPlayer = {
  getCurrentTime: () => number;
  seekTo: (sec: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
};

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
  const [quizRetryLectureId, setQuizRetryLectureId] = useState<number | null>(null);

  // 최종 시험 모달
  const [examModal, setExamModal] = useState<{ exam: AssessmentResponse } | null>(null);
  const [examLoading, setExamLoading] = useState(false);

  // 피드백 모달
  const [feedbackModal, setFeedbackModal] = useState<{ enrollmentId: number } | null>(null);
  const [feedbackDone, setFeedbackDone] = useState<FeedbackResponse | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackingRef = useRef<Tracking>(createTracking());
  const currentVideoRef = useRef<MyCourseVideoStatus | null>(null);

  // seek 방지용
  const highWaterMarkRef = useRef(0);                          // <video> 최대 도달 초
  const ytPlayerRef = useRef<YTPlayer | null>(null);          // YouTube Player 인스턴스
  const ytHighWaterMarkRef = useRef(0);                       // YouTube 최대 도달 초
  const ytIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionSaveInFlightRef = useRef(false);
  const completionSentRef = useRef(false);
  // markCompleted / triggerQuiz를 ref로 보관 (initYTPlayer 내부에서 호출 시 선언 순서 문제 방지)
  const markCompletedRef = useRef<(id: number) => void>(() => {});
  const triggerQuizRef = useRef<(lectureId: number) => void>(() => {});

  // ── 강좌 목록 로드 ──────────────────────────────────────────
  useEffect(() => {
    getMyCourses(0, 20)
      .then((page) => {
        setMyCourses(page.content);
        const requestedCourseId = getInitialCourseIdFromUrl();
        const requestedCourse = page.content.find((course) => course.courseId === requestedCourseId);
        if (requestedCourse) {
          setSelectedCourseId(requestedCourse.courseId);
        } else if (page.content.length > 0) {
          setSelectedCourseId(page.content[0].courseId);
        }
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
    getMyCourseDetail(selectedCourseId)
      .then((d) => {
        setDetail(d);
        const sorted = sortVideos(d.videos ?? []);
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

  const saveCompletionIfReady = useCallback((video: MyCourseVideoStatus, watchedSec: number) => {
    if (video.isCompleted || video.durationSec <= 0) return;
    if (watchedSec < video.durationSec * 0.8) return;
    if (completionSentRef.current || completionSaveInFlightRef.current) return;

    completionSentRef.current = true;
    completionSaveInFlightRef.current = true;

    endVideoWatch(video.videoId, watchedSec)
      .then((result) => {
        completionSaveInFlightRef.current = false;
        if (result.videoCompleted) {
          markCompletedRef.current(video.videoId);
          setStatusMsg('영상 시청 완료! 다음 강의를 수강할 수 있습니다.');
          if (result.lectureCompleted) triggerQuizRef.current(video.lectureId);
        } else {
          completionSentRef.current = false;
        }
      })
      .catch((err) => {
        completionSentRef.current = false;
        completionSaveInFlightRef.current = false;
        const detail = getApiErrorDetail(err);
        setStatusMsg(`영상 완료 저장에 실패했습니다.${detail ? ` (${detail})` : ''} 잠시 후 다시 재생해 주세요.`);
      });
  }, []);

  const startYtGuard = useCallback(() => {
    stopYtGuard();
    ytIntervalRef.current = setInterval(() => {
      const player = ytPlayerRef.current;
      const video = currentVideoRef.current;
      const tracking = trackingRef.current;
      if (!player) return;
      try {
        const current = player.getCurrentTime();
        if (current > ytHighWaterMarkRef.current + 2) {
          // 2초 이상 앞으로 이동 시 되돌림
          player.seekTo(ytHighWaterMarkRef.current, true);
          setStatusMsg('⚠️ 앞으로 건너뛸 수 없습니다. 순서대로 시청해 주세요.');
        } else {
          ytHighWaterMarkRef.current = Math.max(ytHighWaterMarkRef.current, current);
          if (video) {
            const elapsed = tracking.playing && tracking.startedAtMs > 0
              ? Math.floor((performance.now() - tracking.startedAtMs) / 1000)
              : 0;
            const watchedSec = Math.max(
              Math.floor(ytHighWaterMarkRef.current),
              tracking.accSec + Math.max(0, elapsed),
            );
            saveCompletionIfReady(video, watchedSec);
          }
        }
      } catch { /* player 아직 준비 안 됨 */ }
    }, 500);
  }, [saveCompletionIfReady, stopYtGuard]);

  // ── YouTube Player 초기화 ────────────────────────────────────
  const initYTPlayer = useCallback((videoId: string, startSec: number) => {
    ytHighWaterMarkRef.current = startSec;
    // NOTE: trackingRef.current를 직접 참조해야 영상 전환 후 새 tracking 객체를 올바르게 사용
    // (로컬 변수로 캡처하면 stale closure 발생)

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
        playerVars: { start: Math.floor(startSec), rel: 0, modestbranding: 1, origin: window.location.origin },
        events: {
          onReady: () => {
            setStatusMsg('영상을 재생하세요. 앞으로 건너뛰기는 제한됩니다.');
          },
          onStateChange: (e: { data: number }) => {
            const state = (window as { YT?: { PlayerState?: Record<string, number> } }).YT?.PlayerState;
            const video = currentVideoRef.current;
            const tracking = trackingRef.current; // stale closure 방지: 매 이벤트마다 최신 ref 참조

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
              // YouTube ENDED 이벤트 시: accSec가 0이면 durationSec를 전송
              // (YouTube 영상 길이 ≠ DB duration_sec 불일치로 tracking이 0이 되는 경우 방어)
              const isEnded = e.data === (state?.ENDED ?? 0);
              const watchedToSend = isEnded && tracking.accSec === 0
                ? video.durationSec
                : tracking.accSec;
              endVideoWatch(video.videoId, watchedToSend)
                .then((result) => {
                  if (result.videoCompleted) {
                    completionSentRef.current = true;
                    markCompletedRef.current(video.videoId);
                    setStatusMsg('영상 시청 완료! 다음 강의를 수강할 수 있습니다.');
                    if (result.lectureCompleted) triggerQuizRef.current(video.lectureId);
                  } else {
                    setStatusMsg(isEnded ? `시청 종료 — ${watchedToSend}초 기록됨` : `일시정지 — 시청 ${watchedToSend}초 저장`);
                  }
                })
                .catch((err) => {
                  const detail = getApiErrorDetail(err);
                  setStatusMsg(`시청 시간 저장에 실패했습니다.${detail ? ` (${detail})` : ''}`);
                });
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
    completionSentRef.current = Boolean(currentVideo?.isCompleted);
    completionSaveInFlightRef.current = false;
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
  const sortedVideos = sortVideos(detail?.videos ?? []);
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
        setQuizRetryLectureId(null);
        setQuizModal({ quiz, lectureId });
      }
    } catch { /* 퀴즈 없으면 무시 */ }
  }, []);

  triggerQuizRef.current = triggerQuiz;

  const handleOpenExam = async () => {
    if (!selectedCourseId || !canTakeExam) return;
    setExamLoading(true);
    try {
      const exam = await getExam(selectedCourseId);
      setExamModal({ exam });
    } catch {
      setStatusMsg('시험 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setExamLoading(false);
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
          completionSentRef.current = true;
          markCompleted(video.videoId);
          if (result.lectureCompleted) triggerQuiz(video.lectureId);
        }
      })
      .catch((err) => {
        const detail = getApiErrorDetail(err);
        setStatusMsg(`시청 시간 저장에 실패했습니다.${detail ? ` (${detail})` : ''}`);
      });
  }, [flushWatchedSec, markCompleted, triggerQuiz]);

  const handleEnded = useCallback(() => {
    flushWatchedSec();
    const video = currentVideoRef.current;
    if (!video) return;
    endVideoWatch(video.videoId, trackingRef.current.accSec)
      .then((result) => {
        if (result.videoCompleted) {
          completionSentRef.current = true;
          markCompleted(video.videoId);
          setStatusMsg('영상 시청 완료! 다음 강의를 수강할 수 있습니다.');
          if (result.lectureCompleted) triggerQuiz(video.lectureId);
        } else {
          setStatusMsg(`시청 종료 — ${trackingRef.current.accSec}초 기록됨`);
        }
      })
      .catch((err) => {
        const detail = getApiErrorDetail(err);
        setStatusMsg(`시청 종료 저장에 실패했습니다.${detail ? ` (${detail})` : ''}`);
      });
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
    const video = currentVideoRef.current;
    if (!videoEl) return;
    // 재생 중 도달한 최대 위치 업데이트
    if (!videoEl.paused) {
      highWaterMarkRef.current = Math.max(highWaterMarkRef.current, videoEl.currentTime);
      if (video) saveCompletionIfReady(video, Math.floor(highWaterMarkRef.current));
    }
  }, [saveCompletionIfReady]);

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
  const hasExam = Boolean(detail?.exam);
  const examPassed = detail?.exam ? Boolean(detail.exam.completed) : true;
  const canTakeExam = hasExam && allVideosCompleted && learningCompleted && !examPassed;
  const completionGuideText = hasExam
    ? examPassed
      ? '최종 시험에 합격했습니다.'
      : quizCompleted
        ? '최종 시험에 도전해 이수를 완료하세요.'
        : '퀴즈 합격 후 최종 시험에 응시할 수 있습니다.'
    : quizCompleted
      ? '수강 완료 조건을 충족했습니다.'
      : '퀴즈 합격 후 이수를 완료할 수 있습니다.';
  const retryQuizVideo = quizRetryLectureId
    ? sortedVideos.find((video) => video.lectureId === quizRetryLectureId)
    : null;
  const canRetryQuiz = quizRetryLectureId !== null && !quizCompleted;
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

  return (
    <div className="flex flex-col gap-4">

      {quizModal && (
        <QuizModal
          quiz={quizModal.quiz}
          lectureId={quizModal.lectureId}
          onClose={(passed) => {
            if (passed) {
              setQuizRetryLectureId(null);
              if (selectedCourseId) getMyCourseDetail(selectedCourseId).then(setDetail).catch(() => {});
            } else {
              setQuizRetryLectureId(quizModal.lectureId);
            }
            setQuizModal(null);
          }}
        />
      )}

      {examModal && (
        <ExamModal
          exam={examModal.exam}
          onClose={() => setExamModal(null)}
          onResult={(passed) => {
            if (passed && selectedCourseId) getMyCourseDetail(selectedCourseId).then(setDetail).catch(() => {});
          }}
        />
      )}

      {feedbackModal && (
        <FeedbackModal
          enrollmentId={feedbackModal.enrollmentId}
          onClose={() => setFeedbackModal(null)}
          onSubmitted={(feedback) => { setFeedbackDone(feedback); setFeedbackModal(null); }}
        />
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
                              completionSentRef.current = true;
                              markCompleted(currentVideo.videoId);
                              setStatusMsg('시청 완료로 표시했습니다.');
                              if (result.lectureCompleted) triggerQuiz(currentVideo.lectureId);
                            }
                          })
                          .catch((err) => {
                            const detail = getApiErrorDetail(err);
                            setStatusMsg(`완료 처리에 실패했습니다.${detail ? ` (${detail})` : ''}`);
                          });
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
                          {completionGuideText}
                        </div>
                      </div>
                    </div>
                    {hasExam && (canTakeExam ? (
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
                    ))}
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
