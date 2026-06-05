'use client';
import React, { useEffect, useState } from 'react';
import {
  getNotices, createNotice, updateNotice, deleteNotice,
  NoticeResponse, NoticeRequest,
} from '@/api/adminApi';

const EMPTY_FORM: NoticeRequest = { title: '', content: '' };

export default function NoticesAdminPage() {
  const [notices, setNotices] = useState<NoticeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKw, setSearchKw] = useState('');

  // 목록 뷰 vs 편집/작성 뷰
  const [view, setView] = useState<'list' | 'detail' | 'edit'>('list');
  const [selected, setSelected] = useState<NoticeResponse | null>(null);
  const [form, setForm] = useState<NoticeRequest>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getNotices()
      .then(setNotices)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = notices.filter(
    (n) => !searchKw || n.title.includes(searchKw) || n.content.includes(searchKw)
  );

  const openDetail = (n: NoticeResponse) => {
    setSelected(n);
    setView('detail');
  };

  const openCreate = () => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setView('edit');
  };

  const openEdit = (n: NoticeResponse) => {
    setSelected(n);
    setForm({ title: n.title, content: n.content });
    setFormError('');
    setView('edit');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('공지사항을 삭제하시겠습니까?')) return;
    try {
      await deleteNotice(id);
      setNotices((prev) => prev.filter((n) => n.noticeId !== id));
      if (view !== 'list') setView('list');
    } catch { alert('삭제 실패'); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError('제목을 입력하세요.'); return; }
    if (!form.content.trim()) { setFormError('내용을 입력하세요.'); return; }
    setSaving(true);
    try {
      if (selected) {
        const updated = await updateNotice(selected.noticeId, form);
        setNotices((prev) => prev.map((n) => n.noticeId === updated.noticeId ? updated : n));
        setSelected(updated);
        setView('detail');
      } else {
        const created = await createNotice(form);
        setNotices((prev) => [created, ...prev]);
        setView('list');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  // ─── 편집/작성 화면 ──────────────────────────────────────────────────────────
  if (view === 'edit') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView(selected ? 'detail' : 'list')}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            ← 뒤로
          </button>
          <h1 className="text-xl font-black text-[#1a1a2e]">
            {selected ? '공지사항 수정' : '공지사항 작성'}
          </h1>
        </div>
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500">제목 *</label>
            <input
              required
              type="text"
              className="p-3 text-sm border border-black/10 rounded-xl outline-none focus:border-[#4A90D9]"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500">내용 *</label>
            <textarea
              required
              rows={12}
              className="p-3 text-sm border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] resize-none leading-relaxed"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>
          {formError && (
            <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {formError}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setView(selected ? 'detail' : 'list')}
              className="flex-1 py-2.5 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 text-xs font-bold bg-[#4A90D9] hover:bg-[#3a7fc9] disabled:bg-gray-300 text-white rounded-xl transition-colors"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ─── 상세 화면 ───────────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setView('list')}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            ← 목록으로
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => openEdit(selected)}
              className="px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"
            >
              수정
            </button>
            <button
              onClick={() => handleDelete(selected.noticeId)}
              className="px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-6">
          <div className="border-b border-gray-100 pb-4 mb-4">
            <h2 className="text-lg font-black text-[#1a1a2e] mb-2">{selected.title}</h2>
            <div className="flex gap-4 text-xs text-gray-400">
              <span>작성자: {selected.authorName}</span>
              <span>조회수: {selected.viewCount}</span>
              <span>등록: {selected.createdAt?.slice(0, 10)}</span>
              {selected.updatedAt !== selected.createdAt && (
                <span>수정: {selected.updatedAt?.slice(0, 10)}</span>
              )}
            </div>
          </div>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {selected.content}
          </div>
        </div>
      </div>
    );
  }

  // ─── 목록 화면 ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-black text-[#1a1a2e]">공지사항 관리</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-xs font-bold bg-[#4A90D9] hover:bg-[#3a7fc9] text-white rounded-xl transition-colors"
        >
          + 공지 작성
        </button>
      </div>

      <input
        type="text"
        placeholder="제목 또는 내용 검색"
        value={searchKw}
        onChange={(e) => setSearchKw(e.target.value)}
        className="w-full max-w-sm p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] bg-white"
      />

      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">공지사항이 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((n, idx) => (
              <div
                key={n.noticeId}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors"
              >
                <button
                  onClick={() => openDetail(n)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-gray-300 w-6 shrink-0">{filtered.length - idx}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-700 truncate">{n.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {n.authorName} · {n.createdAt?.slice(0, 10)} · 조회 {n.viewCount}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="flex gap-1.5 ml-3 shrink-0">
                  <button
                    onClick={() => openEdit(n)}
                    className="px-2.5 py-1 text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(n.noticeId)}
                    className="px-2.5 py-1 text-[10px] font-semibold bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
