'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getAdminCourses, AdminCourseResponse,
  getLectures, createLecture, updateLecture, deleteLecture, LectureResponse, LectureRequest,
  getVideos, createVideo, updateVideo, deleteVideo, VideoResponse, VideoRequest,
  getQuiz, createQuiz, updateQuiz, deleteQuiz, addQuizQuestion, updateQuizQuestion, deleteQuizQuestion,
  QuizResponse, QuizRequest, QuestionItem, ChoiceItem,
  getExam, createExam, updateExam, deleteExam, addExamQuestion, updateExamQuestion, deleteExamQuestion,
  ExamResponse, ExamRequest,
  getExamAttempts, getExamStats,
} from '@/api/adminApi';
import type { AdminAttemptItem, AdminExamStats } from '@/api/types';

// ─── 문항 편집기 ──────────────────────────────────────────────────────────────
const EMPTY_CHOICE = (): ChoiceItem => ({ choiceText: '', correct: false, sortOrder: 0 });
const EMPTY_QUESTION = (): QuestionItem => ({
  questionText: '', score: 10, sortOrder: 0,
  choices: [EMPTY_CHOICE(), EMPTY_CHOICE(), EMPTY_CHOICE(), EMPTY_CHOICE()],
});

function QuestionEditor({
  question,
  onChange,
  onDelete,
  index,
}: {
  question: QuestionItem;
  onChange: (q: QuestionItem) => void;
  onDelete: () => void;
  index: number;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-[#4A90D9]">문항 {index + 1}</span>
        <button onClick={onDelete} className="text-[10px] text-red-400 hover:text-red-600 font-semibold">삭제</button>
      </div>
      <div className="flex gap-2 items-start">
        <textarea
          rows={2}
          placeholder="문항 내용"
          className="flex-1 p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#4A90D9] resize-none"
          value={question.questionText}
          onChange={(e) => onChange({ ...question, questionText: e.target.value })}
        />
        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-[10px] text-gray-400 font-bold">배점</label>
          <input
            type="number" min={1}
            className="w-16 p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#4A90D9] text-center"
            value={question.score}
            onChange={(e) => onChange({ ...question, score: Number(e.target.value) })}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold text-gray-400">선택지 (정답 체크)</label>
        {question.choices.map((c, ci) => (
          <div key={ci} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={c.correct}
              onChange={(e) => {
                const updated = question.choices.map((x, xi) =>
                  xi === ci ? { ...x, correct: e.target.checked } : x
                );
                onChange({ ...question, choices: updated });
              }}
              className="w-3.5 h-3.5 accent-[#4A90D9]"
            />
            <input
              type="text"
              placeholder={`선택지 ${ci + 1}`}
              className="flex-1 p-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#4A90D9]"
              value={c.choiceText}
              onChange={(e) => {
                const updated = question.choices.map((x, xi) =>
                  xi === ci ? { ...x, choiceText: e.target.value, sortOrder: ci } : x
                );
                onChange({ ...question, choices: updated });
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 퀴즈/시험 편집기 ────────────────────────────────────────────────────────
function QuizExamEditor({
  title,
  data,
  onCreateOrUpdate,
  onDelete: onDeleteParent,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
}: {
  title: string;
  data: QuizResponse | ExamResponse | null;
  onCreateOrUpdate: (req: QuizRequest | ExamRequest) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddQuestion: (q: QuestionItem) => Promise<void>;
  onUpdateQuestion: (qId: number, q: QuestionItem) => Promise<void>;
  onDeleteQuestion: (qId: number) => Promise<void>;
}) {
  const [form, setForm] = useState<QuizRequest>({ title: data?.title ?? '', passScore: data?.passScore ?? 60 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newQ, setNewQ] = useState<QuestionItem>(EMPTY_QUESTION());
  const [addingQ, setAddingQ] = useState(false);
  const [editingQ, setEditingQ] = useState<{ id: number; q: QuestionItem } | null>(null);

  useEffect(() => {
    setForm({ title: data?.title ?? '', passScore: data?.passScore ?? 60 });
  }, [data]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try { await onCreateOrUpdate(form); }
    catch { setError('저장 실패'); }
    finally { setSaving(false); }
  };

  const handleAddQ = async () => {
    if (!newQ.questionText.trim()) { setError('문항 내용을 입력하세요.'); return; }
    if (newQ.choices.filter(c => c.choiceText.trim()).length < 2) { setError('선택지를 2개 이상 입력하세요.'); return; }
    if (!newQ.choices.some(c => c.correct)) { setError('정답을 1개 이상 선택하세요.'); return; }
    setSaving(true); setError('');
    try {
      await onAddQuestion({ ...newQ, sortOrder: (data?.questions?.length ?? 0) });
      setNewQ(EMPTY_QUESTION());
      setAddingQ(false);
    } catch { setError('문항 저장 실패'); }
    finally { setSaving(false); }
  };

  const handleUpdateQ = async () => {
    if (!editingQ) return;
    setSaving(true); setError('');
    try { await onUpdateQuestion(editingQ.id, editingQ.q); setEditingQ(null); }
    catch { setError('문항 수정 실패'); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSave} className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-400">{title} 제목</label>
          <input
            type="text" required
            className="p-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-[#4A90D9] w-52"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-400">합격 점수</label>
          <input
            type="number" min={0} max={100}
            className="p-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-[#4A90D9] w-20 text-center"
            value={form.passScore}
            onChange={(e) => setForm({ ...form, passScore: Number(e.target.value) })}
          />
        </div>
        <button type="submit" disabled={saving}
          className="px-4 py-2 text-xs font-bold bg-[#4A90D9] hover:bg-[#3a7fc9] disabled:bg-gray-300 text-white rounded-xl transition-colors">
          {data ? '수정' : '생성'}
        </button>
        {data && (
          <button type="button" onClick={async () => { if (confirm(`${title}를 삭제하시겠습니까?`)) await onDeleteParent(); }}
            className="px-4 py-2 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors">
            삭제
          </button>
        )}
      </form>

      {data && (
        <>
          <div className="flex flex-col gap-2">
            {(data.questions ?? []).map((q, i) => (
              <div key={`${q.questionId}-${i}`} className="border border-gray-200 rounded-xl p-3 bg-white">
                {editingQ !== null && editingQ.id === q.questionId ? (
                  <div className="flex flex-col gap-2">
                    <QuestionEditor
                      question={editingQ.q} index={i}
                      onChange={(updated) => setEditingQ(editingQ ? { id: editingQ.id, q: updated } : null)}
                      onDelete={() => setEditingQ(null)}
                    />
                    <div className="flex gap-2">
                      <button onClick={handleUpdateQ} disabled={saving}
                        className="px-3 py-1.5 text-[11px] font-bold bg-[#4A90D9] text-white rounded-lg disabled:bg-gray-300">
                        저장
                      </button>
                      <button onClick={() => setEditingQ(null)}
                        className="px-3 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg">
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-xs font-bold text-gray-700 mb-1">Q{i + 1}. {q.questionText}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(q.choices ?? []).map((c, ci) => (
                          <span key={ci} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            c.correct ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {c.choiceText || `선택지${ci+1}`}
                            {c.correct && ' ✓'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => setEditingQ({ id: q.questionId!, q: { ...q, choices: [...(q.choices ?? [])] } })}
                        className="px-2 py-1 text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg">
                        수정
                      </button>
                      <button onClick={async () => { if (confirm('문항을 삭제하시겠습니까?')) await onDeleteQuestion(q.questionId!); }}
                        className="px-2 py-1 text-[10px] font-semibold bg-red-50 hover:bg-red-100 text-red-500 rounded-lg">
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {addingQ ? (
            <div className="flex flex-col gap-2 border border-dashed border-[#4A90D9] rounded-xl p-4">
              <QuestionEditor question={newQ} index={data.questions?.length ?? 0}
                onChange={setNewQ} onDelete={() => setAddingQ(false)} />
              <div className="flex gap-2">
                <button onClick={handleAddQ} disabled={saving}
                  className="px-3 py-1.5 text-[11px] font-bold bg-[#4A90D9] text-white rounded-lg disabled:bg-gray-300">
                  문항 추가
                </button>
                <button onClick={() => setAddingQ(false)}
                  className="px-3 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg">
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingQ(true)}
              className="text-xs font-bold text-[#4A90D9] hover:text-[#3a7fc9] py-2 border border-dashed border-[#4A90D9]/30 hover:border-[#4A90D9] rounded-xl transition-colors">
              + 문항 추가
            </button>
          )}
        </>
      )}

      {error && <div className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
    </div>
  );
}

// ─── 단원(Lecture) 아코디언 ───────────────────────────────────────────────────
function LectureAccordion({
  lecture,
  courseId,
  onUpdate,
  onDelete,
}: {
  lecture: LectureResponse;
  courseId: number;
  onUpdate: (updated: LectureResponse) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [videos, setVideos] = useState<VideoResponse[]>([]);
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [loadedContent, setLoadedContent] = useState(false);
  const [editingLecture, setEditingLecture] = useState(false);
  const [lForm, setLForm] = useState<LectureRequest>({
    title: lecture.title, description: lecture.description, sortOrder: lecture.sortOrder,
  });
  const [addingVideo, setAddingVideo] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoResponse | null>(null);
  const [vForm, setVForm] = useState<VideoRequest>({ title: '', videoUrl: '', durationSec: 0, sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'quiz'>('videos');

  const loadContent = useCallback(async () => {
    if (loadedContent) return;
    const [vs, qz] = await Promise.all([
      getVideos(lecture.lectureId),
      getQuiz(lecture.lectureId),
    ]);
    setVideos(vs);
    setQuiz(qz);
    setLoadedContent(true);
  }, [lecture.lectureId, loadedContent]);

  const toggleOpen = () => {
    if (!open) loadContent();
    setOpen(!open);
  };

  const handleLectureSave = async () => {
    setSaving(true);
    try {
      const updated = await updateLecture(courseId, lecture.lectureId, lForm);
      onUpdate(updated);
      setEditingLecture(false);
    } catch { alert('저장 실패'); }
    finally { setSaving(false); }
  };

  const handleVideoSave = async () => {
    setSaving(true);
    try {
      if (editingVideo) {
        const updated = await updateVideo(lecture.lectureId, editingVideo.videoId, vForm);
        setVideos((prev) => prev.map((v) => v.videoId === updated.videoId ? updated : v));
        setEditingVideo(null);
      } else {
        const created = await createVideo(lecture.lectureId, { ...vForm, sortOrder: videos.length });
        setVideos((prev) => [...prev, created]);
        setAddingVideo(false);
      }
      setVForm({ title: '', videoUrl: '', durationSec: 0, sortOrder: 0 });
    } catch { alert('영상 저장 실패'); }
    finally { setSaving(false); }
  };

  const handleDeleteVideo = async (videoId: number) => {
    if (!confirm('영상을 삭제하시겠습니까?')) return;
    await deleteVideo(lecture.lectureId, videoId);
    setVideos((prev) => prev.filter((v) => v.videoId !== videoId));
  };

  const openEditVideo = (v: VideoResponse) => {
    setEditingVideo(v);
    setVForm({ title: v.title, videoUrl: v.videoUrl, durationSec: v.durationSec, sortOrder: v.sortOrder });
    setAddingVideo(false);
  };

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      {/* 단원 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50/50 cursor-pointer"
        onClick={toggleOpen}>
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-[#4A90D9]/10 text-[#4A90D9] text-[11px] font-black flex items-center justify-center">
            {lecture.sortOrder + 1}
          </span>
          {editingLecture ? (
            <input
              type="text"
              className="p-1.5 text-xs border border-[#4A90D9] rounded-lg outline-none w-48"
              value={lForm.title}
              onChange={(e) => setLForm({ ...lForm, title: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-sm font-bold text-gray-700">{lecture.title}</span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {editingLecture ? (
            <>
              <button onClick={handleLectureSave} disabled={saving}
                className="px-2.5 py-1 text-[10px] font-bold bg-[#4A90D9] text-white rounded-lg disabled:bg-gray-300">
                저장
              </button>
              <button onClick={() => setEditingLecture(false)}
                className="px-2.5 py-1 text-[10px] font-semibold border border-gray-200 rounded-lg">
                취소
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditingLecture(true); setLForm({ title: lecture.title, description: lecture.description, sortOrder: lecture.sortOrder }); }}
                className="px-2.5 py-1 text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg">
                수정
              </button>
              <button onClick={() => { if (confirm('단원을 삭제하시겠습니까?')) onDelete(); }}
                className="px-2.5 py-1 text-[10px] font-semibold bg-red-50 hover:bg-red-100 text-red-500 rounded-lg">
                삭제
              </button>
            </>
          )}
          <span className="text-gray-400 text-sm ml-1">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* 단원 내용 (펼쳐짐) */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50/30 p-4">
          {/* 탭 */}
          <div className="flex gap-1 mb-4">
            {(['videos', 'quiz'] as const).map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === t ? 'bg-[#4A90D9] text-white' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                }`}>
                {t === 'videos' ? '📹 영상 목록' : '📝 단원 퀴즈'}
              </button>
            ))}
          </div>

          {activeTab === 'videos' && (
            <div className="flex flex-col gap-2">
              {videos.length === 0 && !addingVideo && (
                <div className="text-xs text-gray-400 text-center py-4">등록된 영상이 없습니다.</div>
              )}
              {videos.map((v, vi) => (
                <div key={v.videoId}>
                  {editingVideo?.videoId === v.videoId ? (
                    <VideoForm vForm={vForm} setVForm={setVForm} onSave={handleVideoSave}
                      onCancel={() => setEditingVideo(null)} saving={saving} label="수정" />
                  ) : (
                    <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-gray-400">{vi + 1}</span>
                        <div>
                          <div className="text-xs font-semibold text-gray-700">{v.title || '(제목 없음)'}</div>
                          <div className="text-[10px] text-gray-400 truncate max-w-[300px]">{v.videoUrl}</div>
                        </div>
                        <span className="text-[10px] text-gray-400 ml-2">{Math.floor(v.durationSec / 60)}분 {v.durationSec % 60}초</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => openEditVideo(v)}
                          className="px-2 py-1 text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg">수정</button>
                        <button onClick={() => handleDeleteVideo(v.videoId)}
                          className="px-2 py-1 text-[10px] font-semibold bg-red-50 hover:bg-red-100 text-red-500 rounded-lg">삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {addingVideo && (
                <VideoForm vForm={vForm} setVForm={setVForm} onSave={handleVideoSave}
                  onCancel={() => setAddingVideo(false)} saving={saving} label="추가" />
              )}
              {!addingVideo && !editingVideo && (
                <button onClick={() => { setAddingVideo(true); setVForm({ title: '', videoUrl: '', durationSec: 0, sortOrder: videos.length }); }}
                  className="text-xs font-bold text-[#4A90D9] hover:text-[#3a7fc9] py-2 border border-dashed border-[#4A90D9]/30 hover:border-[#4A90D9] rounded-xl transition-colors w-full">
                  + 영상 추가
                </button>
              )}
            </div>
          )}

          {activeTab === 'quiz' && (
            <QuizExamEditor
              title="퀴즈"
              data={quiz}
              onCreateOrUpdate={async (req) => {
                const res = quiz
                  ? await updateQuiz(lecture.lectureId, req as QuizRequest)
                  : await createQuiz(lecture.lectureId, req as QuizRequest);
                setQuiz(res);
              }}
              onDelete={async () => { await deleteQuiz(lecture.lectureId); setQuiz(null); }}
              onAddQuestion={async (q) => { const res = await addQuizQuestion(lecture.lectureId, q); setQuiz(res); }}
              onUpdateQuestion={async (qId, q) => { const res = await updateQuizQuestion(lecture.lectureId, qId, q); setQuiz(res); }}
              onDeleteQuestion={async (qId) => { const res = await deleteQuizQuestion(lecture.lectureId, qId); setQuiz(res); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function extractYoutubeId(url: string): string | null {
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) return shortMatch[1];
  return null;
}

function VideoForm({ vForm, setVForm, onSave, onCancel, saving, label }: {
  vForm: VideoRequest; setVForm: (v: VideoRequest) => void;
  onSave: () => void; onCancel: () => void; saving: boolean; label: string;
}) {
  const [detecting, setDetecting] = useState(false);
  const isYoutube = /youtube\.com|youtu\.be/.test(vForm.videoUrl);
  const mins = Math.floor(vForm.durationSec / 60);
  const secs = vForm.durationSec % 60;

  const detectDuration = () => {
    const videoId = extractYoutubeId(vForm.videoUrl);
    if (!videoId) return;
    setDetecting(true);

    const divId = `yt-detect-${Date.now()}`;
    const div = document.createElement('div');
    div.id = divId;
    Object.assign(div.style, { position: 'fixed', left: '-9999px', top: '-9999px', width: '1px', height: '1px' });
    document.body.appendChild(div);

    const cleanup = (duration?: number) => {
      try { document.body.removeChild(div); } catch {}
      if (duration != null && duration > 0) setVForm({ ...vForm, durationSec: Math.ceil(duration) });
      setDetecting(false);
    };

    const createPlayer = () => {
      const YT = (window as { YT?: { Player?: new (...a: unknown[]) => unknown } }).YT;
      if (!YT?.Player) { setTimeout(createPlayer, 300); return; }
      new (YT.Player as new (id: string, opts: unknown) => unknown)(divId, {
        videoId, width: 1, height: 1,
        events: {
          onReady: (e: { target: { getDuration: () => number } }) => cleanup(e.target.getDuration()),
          onError: () => cleanup(),
        },
      });
    };

    if ((window as { YT?: { Player?: unknown } }).YT?.Player) {
      createPlayer();
    } else {
      (window as { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = createPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      setTimeout(() => { if (detecting) cleanup(); }, 12000);
    }
  };

  return (
    <div className="bg-white border border-dashed border-[#4A90D9] rounded-xl p-3 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400">영상 제목</label>
          <input type="text" placeholder="예: 1. OT 소개" value={vForm.title}
            className="p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#4A90D9]"
            onChange={(e) => setVForm({ ...vForm, title: e.target.value })} />
        </div>
        {/* 분:초 입력 */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400">
            재생 시간 <span className="text-gray-300">(총 {vForm.durationSec}초)</span>
          </label>
          <div className="flex items-center gap-1">
            <input type="number" min={0} max={999} value={mins}
              className="w-14 p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#4A90D9] text-center"
              onChange={(e) => setVForm({ ...vForm, durationSec: Math.max(0, Number(e.target.value)) * 60 + secs })} />
            <span className="text-[10px] text-gray-400 shrink-0">분</span>
            <input type="number" min={0} max={59} value={secs}
              className="w-14 p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#4A90D9] text-center"
              onChange={(e) => setVForm({ ...vForm, durationSec: mins * 60 + Math.min(59, Math.max(0, Number(e.target.value))) })} />
            <span className="text-[10px] text-gray-400 shrink-0">초</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400">영상 URL</label>
        <div className="flex gap-1.5">
          <input type="text" placeholder="https://..." value={vForm.videoUrl}
            className="flex-1 p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#4A90D9]"
            onChange={(e) => setVForm({ ...vForm, videoUrl: e.target.value })} />
          {isYoutube && (
            <button type="button" onClick={detectDuration} disabled={detecting}
              className="shrink-0 px-2.5 py-1.5 text-[11px] bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 font-bold rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap">
              {detecting ? '감지 중…' : '⏱ 자동 감지'}
            </button>
          )}
        </div>
        {isYoutube && (
          <p className="text-[10px] text-blue-500">YouTube URL 감지됨 — "자동 감지" 버튼으로 영상 길이를 불러올 수 있습니다.</p>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving}
          className="px-3 py-1.5 text-[11px] font-bold bg-[#4A90D9] text-white rounded-lg disabled:bg-gray-300">
          {saving ? '저장 중…' : label}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg">취소</button>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = Number(params.courseId);

  const [course, setCourse] = useState<AdminCourseResponse | null>(null);
  const [lectures, setLectures] = useState<LectureResponse[]>([]);
  const [exam, setExam] = useState<ExamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'lectures' | 'exam' | 'results'>('lectures');
  const [attempts, setAttempts] = useState<AdminAttemptItem[]>([]);
  const [examStats, setExamStats] = useState<AdminExamStats | null>(null);
  const [addingLecture, setAddingLecture] = useState(false);
  const [newLectureTitle, setNewLectureTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getAdminCourses().then((list) => list.find((c) => c.courseId === courseId) ?? null),
      getLectures(courseId),
      getExam(courseId),
    ])
      .then(([c, ls, ex]) => {
        setCourse(c);
        setLectures(ls);
        setExam(ex);
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  const handleAddLecture = async () => {
    if (!newLectureTitle.trim()) return;
    setSaving(true);
    try {
      const created = await createLecture(courseId, {
        title: newLectureTitle, description: '', sortOrder: lectures.length,
      });
      setLectures((prev) => [...prev, created]);
      setNewLectureTitle('');
      setAddingLecture(false);
    } catch { alert('단원 추가 실패'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>;

  return (
    <div className="flex flex-col gap-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin/courses')}
          className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold transition-colors">
          ← 목록
        </button>
        <div>
          <h1 className="text-xl font-black text-[#1a1a2e]">{course?.title ?? '강좌'}</h1>
          <p className="text-xs text-gray-400">{course?.category} · {course?.durationMin ? `${course.durationMin}분` : '-'}</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        {([['lectures', '📚 강의 구성'], ['exam', '📋 최종 시험'], ['results', '📊 응시 결과']] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => {
            setActiveTab(tab);
            if (tab === 'results' && attempts.length === 0) {
              getExamAttempts(courseId).then(setAttempts).catch(() => {});
              getExamStats(courseId).then(setExamStats).catch(() => {});
            }
          }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              activeTab === tab ? 'bg-[#1a1a2e] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* 강의 구성 탭 */}
      {activeTab === 'lectures' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1a1a2e]">
              강의 목록 <span className="text-gray-400 font-normal text-xs ml-1">({lectures.length}개 단원)</span>
            </h2>
            <button onClick={() => setAddingLecture(true)}
              className="px-4 py-2 text-xs font-bold bg-[#4A90D9] hover:bg-[#3a7fc9] text-white rounded-xl transition-colors">
              + 단원 추가
            </button>
          </div>

          {lectures.length === 0 && !addingLecture && (
            <div className="py-12 text-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-100">
              등록된 단원이 없습니다. 단원을 추가하세요.
            </div>
          )}

          <div className="flex flex-col gap-2">
            {lectures.map((lec) => (
              <LectureAccordion
                key={lec.lectureId}
                lecture={lec}
                courseId={courseId}
                onUpdate={(updated) =>
                  setLectures((prev) => prev.map((l) => l.lectureId === updated.lectureId ? updated : l))
                }
                onDelete={async () => {
                  await deleteLecture(courseId, lec.lectureId);
                  setLectures((prev) => prev.filter((l) => l.lectureId !== lec.lectureId));
                }}
              />
            ))}
          </div>

          {addingLecture && (
            <div className="flex items-center gap-2 bg-white border border-dashed border-[#4A90D9] rounded-2xl p-4">
              <span className="w-7 h-7 rounded-lg bg-[#4A90D9]/10 text-[#4A90D9] text-[11px] font-black flex items-center justify-center shrink-0">
                {lectures.length + 1}
              </span>
              <input
                type="text" placeholder="단원 제목 (예: 1강. 개요)" autoFocus
                className="flex-1 p-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-[#4A90D9]"
                value={newLectureTitle}
                onChange={(e) => setNewLectureTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddLecture(); if (e.key === 'Escape') setAddingLecture(false); }}
              />
              <button onClick={handleAddLecture} disabled={saving}
                className="px-3 py-2 text-xs font-bold bg-[#4A90D9] text-white rounded-xl disabled:bg-gray-300">
                추가
              </button>
              <button onClick={() => setAddingLecture(false)}
                className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl">
                취소
              </button>
            </div>
          )}
        </div>
      )}

      {/* 시험 탭 */}
      {activeTab === 'exam' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#1a1a2e] mb-4">최종 시험</h2>
          <QuizExamEditor
            title="시험"
            data={exam}
            onCreateOrUpdate={async (req) => {
              const res = exam ? await updateExam(courseId, req as ExamRequest) : await createExam(courseId, req as ExamRequest);
              setExam(res);
            }}
            onDelete={async () => { await deleteExam(courseId); setExam(null); }}
            onAddQuestion={async (q) => { const res = await addExamQuestion(courseId, q); setExam(res); }}
            onUpdateQuestion={async (qId, q) => { const res = await updateExamQuestion(courseId, qId, q); setExam(res); }}
            onDeleteQuestion={async (qId) => { const res = await deleteExamQuestion(courseId, qId); setExam(res); }}
          />
        </div>
      )}

      {/* 📊 응시 결과 탭 */}
      {activeTab === 'results' && (
        <div className="flex flex-col gap-4">
          {/* 통계 카드 */}
          {examStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '총 응시', value: examStats.totalAttempts, color: 'text-gray-700' },
                { label: '합격', value: examStats.passedCount, color: 'text-emerald-600' },
                { label: '불합격', value: examStats.failedCount, color: 'text-red-500' },
                { label: '합격률', value: `${examStats.passRate}%`, color: 'text-[#4A90D9]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
                  <div className={`text-2xl font-black ${color}`}>{value}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* 응시 목록 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1a1a2e]">응시자 목록</h3>
              {examStats && (
                <span className="text-xs text-gray-400">평균 점수: <strong className="text-gray-700">{examStats.averageScore}점</strong></span>
              )}
            </div>
            {attempts.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">응시 기록이 없습니다.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['사번', '직원명', '점수', '합격여부', '응시일시'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-bold text-gray-500 text-[11px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.attemptId} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-500">{a.employeeNo}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-800">{a.userName}</td>
                      <td className="px-4 py-2.5 font-bold text-[#4A90D9]">{a.score}점</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${a.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                          {a.passed ? '합격' : '불합격'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">{new Date(a.attemptedAt).toLocaleString('ko-KR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
