'use client';
import { useEffect, useState } from 'react';
import { getBoardQuestions, getQuestionDetail, createQuestion } from '@/api/qna';
import { getMyCourses } from '@/api/myLearning';
import type { QnaResponse } from '@/api/types';
import type { QnaBoardItem } from '@/api/qna';

type Filter = 'all' | 'unanswered' | 'answered' | 'mine';

export default function QnaPage() {
  const [board, setBoard]         = useState<QnaBoardItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<Filter>('all');
  const [search, setSearch]       = useState('');

  // 선택된 질문 상세
  const [selected, setSelected]   = useState<QnaBoardItem | null>(null);
  const [detail, setDetail]       = useState<QnaResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 새 질문 폼
  const [showForm, setShowForm]   = useState(false);
  const [courses, setCourses]     = useState<{ courseId: number; courseTitle: string }[]>([]);
  const [form, setForm]           = useState({ courseId: '', title: '', content: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    getBoardQuestions()
      .then(setBoard)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 질문 행 클릭
  const handleRowClick = async (item: QnaBoardItem) => {
    setSelected(item);
    setDetail(null);
    if (!item.isMine) return; // 본인 글 아니면 상세 미조회
    setDetailLoading(true);
    try {
      const d = await getQuestionDetail(item.questionId);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => { setSelected(null); setDetail(null); };

  // 새 질문 폼 열기
  const openForm = async () => {
    setShowForm(true);
    if (courses.length === 0) {
      try {
        const page = await getMyCourses(0, 100);
        setCourses(page.content.map((c) => ({ courseId: c.courseId, courseTitle: c.courseTitle })));
      } catch {}
    }
  };

  const submitQuestion = async () => {
    if (!form.courseId || !form.title.trim() || !form.content.trim()) {
      setFormError('강좌, 제목, 내용을 모두 입력해 주세요.'); return;
    }
    setSubmitting(true); setFormError('');
    try {
      await createQuestion({ courseId: Number(form.courseId), title: form.title.trim(), content: form.content.trim() });
      // 목록 갱신
      const updated = await getBoardQuestions();
      setBoard(updated);
      setForm({ courseId: '', title: '', content: '' });
      setShowForm(false);
    } catch {
      setFormError('질문 등록에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // 필터 + 검색 적용
  const filtered = board.filter((q) => {
    if (filter === 'unanswered' && q.answerCount > 0) return false;
    if (filter === 'answered'   && q.answerCount === 0) return false;
    if (filter === 'mine'       && !q.isMine) return false;
    if (search && !q.title.includes(search) && !q.courseTitle.includes(search)) return false;
    return true;
  });

  const counts = {
    all:        board.length,
    unanswered: board.filter((q) => q.answerCount === 0).length,
    answered:   board.filter((q) => q.answerCount > 0).length,
    mine:       board.filter((q) => q.isMine).length,
  };

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });

  return (
    <div>
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Q&amp;A 게시판</h1>
          <p className="text-xs text-slate-400 mt-0.5">총 {board.length}개의 질문 · 내용은 본인 글만 확인 가능합니다.</p>
        </div>
        <button
          onClick={openForm}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          질문 작성
        </button>
      </div>

      {/* ── 새 질문 폼 ── */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-md p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-slate-800">새 질문 작성</span>
            <button onClick={() => { setShowForm(false); setFormError(''); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">강좌 선택</label>
              <select value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100">
                <option value="">강좌를 선택하세요</option>
                {courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.courseTitle}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">제목</label>
              <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="질문 제목을 입력하세요" maxLength={100}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">내용</label>
              <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="질문 내용을 자세히 입력해 주세요" rows={4}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 placeholder:text-slate-300 resize-none focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"/>
            </div>
            {formError && <p className="text-xs text-red-500 font-medium">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setShowForm(false); setFormError(''); }}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">취소</button>
              <button onClick={submitQuestion} disabled={submitting}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors">
                {submitting ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 게시판 본체 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* 필터 + 검색 바 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 flex-wrap">
          <div className="flex gap-1">
            {([
              { key: 'all',        label: '전체' },
              { key: 'unanswered', label: '미답변' },
              { key: 'answered',   label: '답변완료' },
              { key: 'mine',       label: '내 질문' },
            ] as { key: Filter; label: string }[]).map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}>
                {label}
                <span className={`ml-1 text-[10px] ${filter === key ? 'text-blue-200' : 'text-slate-400'}`}>
                  {counts[key]}
                </span>
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[160px]">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="제목 또는 강좌명 검색" type="text"
                className="flex-1 bg-transparent text-xs text-slate-700 placeholder:text-slate-300 outline-none"/>
            </div>
          </div>
        </div>

        {/* 테이블 헤더 */}
        <div className="hidden sm:grid grid-cols-[2fr_1fr_80px_80px_72px] gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
          <span>제목</span>
          <span>강좌</span>
          <span className="text-center">작성자</span>
          <span className="text-center">답변</span>
          <span className="text-center">날짜</span>
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-40">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p className="text-sm">해당하는 질문이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((item) => (
              <button
                key={item.questionId}
                onClick={() => handleRowClick(item)}
                className={`w-full text-left grid grid-cols-1 sm:grid-cols-[2fr_1fr_80px_80px_72px] gap-1 sm:gap-3 px-5 py-3.5 hover:bg-slate-50/80 transition-colors ${
                  selected?.questionId === item.questionId ? 'bg-blue-50/60' : ''
                }`}
              >
                {/* 제목 */}
                <div className="flex items-center gap-2 min-w-0">
                  {/* 답변 상태 점 */}
                  <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${item.answerCount > 0 ? 'bg-emerald-400' : 'bg-amber-400'}`}/>
                  <span className={`text-sm font-semibold truncate ${item.isMine ? 'text-slate-800' : 'text-slate-600'}`}>
                    {item.title}
                  </span>
                  {item.isMine && (
                    <span className="shrink-0 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">내 글</span>
                  )}
                  {item.resolved && (
                    <span className="shrink-0 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">해결</span>
                  )}
                </div>

                {/* 강좌 */}
                <div className="flex items-center sm:block">
                  <span className="text-[11px] text-slate-400 sm:hidden mr-1">강좌: </span>
                  <span className="text-xs text-slate-500 truncate">{item.courseTitle}</span>
                </div>

                {/* 작성자 */}
                <div className="text-center text-xs text-slate-400">
                  {item.isMine ? (
                    <span className="text-blue-500 font-semibold">나</span>
                  ) : (
                    <span>{item.authorName}</span>
                  )}
                </div>

                {/* 답변 수 */}
                <div className="text-center">
                  {item.answerCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {item.answerCount}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-500 font-medium">대기</span>
                  )}
                </div>

                {/* 날짜 */}
                <div className="text-center text-[11px] text-slate-400">{fmtDate(item.createdAt)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 상세 패널 (슬라이드인) ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={closeDetail}>
          <div
            className="relative w-full max-w-lg h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 패널 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">{selected.courseTitle}</span>
                {selected.isMine && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">내 글</span>
                )}
              </div>
              <button onClick={closeDetail}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* 본인 글 아닌 경우 — 잠금 */}
              {!selected.isMine ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700 mb-1">본인이 작성한 질문만<br/>내용을 확인할 수 있습니다.</p>
                    <p className="text-xs text-slate-400">질문 제목과 답변 여부는 모두에게 공개되지만,<br/>상세 내용은 작성자 본인만 열람 가능합니다.</p>
                  </div>
                </div>
              ) : detailLoading ? (
                <div className="flex items-center justify-center h-32 text-slate-400 text-sm">불러오는 중...</div>
              ) : detail ? (
                <div className="px-6 py-5 space-y-5">
                  {/* 제목 */}
                  <div>
                    <h2 className="text-base font-bold text-slate-800 leading-snug">{detail.title}</h2>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {fmtDate(detail.createdAt)} · {detail.answers.length > 0 ? `답변 ${detail.answers.length}개` : '미답변'}
                    </p>
                  </div>

                  {/* 질문 내용 */}
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-400 mb-2">질문 내용</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{detail.content}</p>
                  </div>

                  {/* 답변 */}
                  {detail.answers.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-3">답변 {detail.answers.length}개</p>
                      <div className="space-y-3">
                        {detail.answers.map((a) => (
                          <div key={a.answerId} className="bg-white rounded-xl border border-slate-200 p-4 border-l-[3px] border-l-blue-400">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                </svg>
                              </div>
                              <span className="text-xs font-bold text-slate-700">{a.authorName}</span>
                              <span className="text-[10px] text-slate-400 ml-auto">{fmtDate(a.createdAt)}</span>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{a.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <p className="text-xs text-amber-700 font-medium">아직 답변이 없습니다. 관리자가 확인 후 답변을 드릴 예정입니다.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-slate-400 text-sm">내용을 불러올 수 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slide-in 0.22s cubic-bezier(0.16,1,0.3,1); }
      `}</style>
    </div>
  );
}
