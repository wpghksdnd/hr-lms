'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAdminCoursesPaged, createCourse, updateCourse, deleteCourse,
  getCourseRounds, createCourseRound, updateCourseRound, deleteCourseRound,
  AdminCourseResponse, AdminCourseRequest, CourseRoundResponse, CourseRoundRequest,
} from '@/api/adminApi';
import Pagination from '@/components/admin/Pagination';

const TARGET_ROLE_LABELS: Record<number, string> = { 0: '전체', 1: '현장직', 2: '사무직' };
const CATEGORY_OPTIONS = ['법정의무교육', '직무교육', '안전교육', '리더십교육', '기타'];

const EMPTY_FORM: AdminCourseRequest = {
  title: '', description: '', category: '직무교육', targetRole: 0, durationMin: undefined, thumbnailUrl: '',
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function oneYearLaterStr() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// ─── Round Modal ──────────────────────────────────────────────────────────────
function RoundModal({
  course,
  onClose,
}: {
  course: AdminCourseResponse;
  onClose: () => void;
}) {
  const [rounds, setRounds] = useState<CourseRoundResponse[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [editRound, setEditRound] = useState<CourseRoundResponse | null>(null);
  const [form, setForm] = useState<CourseRoundRequest>({
    roundNo: 1,
    startDate: todayStr(),
    endDate: oneYearLaterStr(),
  });
  const [roundError, setRoundError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCourseRounds(course.courseId)
      .then((data) => {
        setRounds(data);
        // auto-set next roundNo
        const nextNo = data.length > 0 ? Math.max(...data.map((r) => r.roundNo)) + 1 : 1;
        setForm((f) => ({ ...f, roundNo: nextNo }));
      })
      .catch(() => {})
      .finally(() => setLoadingRounds(false));
  }, [course.courseId]);

  const openEdit = (r: CourseRoundResponse) => {
    setEditRound(r);
    setForm({ roundNo: r.roundNo, startDate: r.startDate, endDate: r.endDate });
    setRoundError('');
  };

  const cancelEdit = () => {
    setEditRound(null);
    const nextNo = rounds.length > 0 ? Math.max(...rounds.map((r) => r.roundNo)) + 1 : 1;
    setForm({ roundNo: nextNo, startDate: todayStr(), endDate: oneYearLaterStr() });
    setRoundError('');
  };

  const handleDelete = async (roundId: number) => {
    if (!confirm('이 차수를 삭제하시겠습니까?')) return;
    try {
      await deleteCourseRound(course.courseId, roundId);
      setRounds((prev) => prev.filter((r) => r.roundId !== roundId));
    } catch { alert('삭제 실패'); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoundError('');
    if (!form.startDate || !form.endDate) { setRoundError('시작일과 종료일을 입력하세요.'); return; }
    if (form.startDate > form.endDate) { setRoundError('종료일은 시작일 이후여야 합니다.'); return; }
    setSaving(true);
    try {
      if (editRound) {
        const updated = await updateCourseRound(course.courseId, editRound.roundId, form);
        setRounds((prev) => prev.map((r) => r.roundId === updated.roundId ? updated : r));
        setEditRound(null);
      } else {
        const created = await createCourseRound(course.courseId, form);
        setRounds((prev) => [...prev, created]);
        const nextNo = Math.max(...[...rounds, created].map((r) => r.roundNo)) + 1;
        setForm({ roundNo: nextNo, startDate: todayStr(), endDate: oneYearLaterStr() });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setRoundError(msg ?? '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-black text-[#1a1a2e]">차수 관리</h2>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[350px]">{course.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          {/* Rounds list */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-2">등록된 차수</h3>
            {loadingRounds ? (
              <div className="text-xs text-gray-400 py-4 text-center">불러오는 중...</div>
            ) : rounds.length === 0 ? (
              <div className="text-xs text-gray-400 py-4 text-center bg-gray-50 rounded-xl">
                등록된 차수가 없습니다. 아래에서 차수를 추가하세요.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {rounds.map((r) => (
                  <div
                    key={r.roundId}
                    className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-[#4A90D9] w-10">{r.roundNo}차</span>
                      <div className="text-xs text-gray-600">
                        {r.startDate} ~ {r.endDate}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.open ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {r.open ? '수강 가능' : '마감'}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEdit(r)}
                        className="px-2.5 py-1 text-[10px] font-semibold bg-white hover:bg-gray-100 text-gray-600 rounded-lg border border-gray-200 transition-colors"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(r.roundId)}
                        className="px-2.5 py-1 text-[10px] font-semibold bg-white hover:bg-red-50 text-red-500 rounded-lg border border-red-100 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add / edit round form */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-xs font-bold text-gray-500 mb-3">
              {editRound ? `${editRound.roundNo}차 수정` : '차수 추가'}
            </h3>
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-400">차수 번호</label>
                  <input
                    type="number"
                    min={1}
                    required
                    disabled={!!editRound}
                    className="p-2 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] disabled:bg-gray-50 disabled:text-gray-400"
                    value={form.roundNo}
                    onChange={(e) => setForm({ ...form, roundNo: Number(e.target.value) })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-400">시작일</label>
                  <input
                    type="date"
                    required
                    className="p-2 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9]"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-400">종료일</label>
                  <input
                    type="date"
                    required
                    className="p-2 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9]"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>

              {roundError && (
                <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {roundError}
                </div>
              )}

              <div className="flex gap-2">
                {editRound && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold bg-[#4A90D9] hover:bg-[#3a7fc9] disabled:bg-gray-300 text-white rounded-xl transition-colors"
                >
                  {saving ? '저장 중...' : editRound ? '수정 저장' : '+ 차수 추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CoursesAdminPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<AdminCourseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminCourseResponse | null>(null);
  const [form, setForm] = useState<AdminCourseRequest>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchKw, setSearchKw] = useState('');
  const [roundCourse, setRoundCourse] = useState<AdminCourseResponse | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 10;

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const result = await getAdminCoursesPaged(p, PAGE_SIZE);
      setCourses(result.content);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePageChange = (p: number) => { setPage(p); load(p); };

  // 현재 페이지 데이터 내 클라이언트 검색
  const filtered = courses.filter((c) =>
    !searchKw || c.title.toLowerCase().includes(searchKw.toLowerCase()) || c.category.includes(searchKw)
  );

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (c: AdminCourseResponse) => {
    setEditTarget(c);
    setForm({
      title: c.title,
      description: c.description,
      category: c.category,
      targetRole: c.targetRole,
      durationMin: c.durationMin ?? undefined,
      thumbnailUrl: c.thumbnailUrl ?? '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('강의를 삭제하시겠습니까?')) return;
    try {
      await deleteCourse(id);
      load(page);
    } catch { alert('삭제 실패'); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim()) { setFormError('강의명을 입력하세요.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, thumbnailUrl: form.thumbnailUrl || undefined };
      if (editTarget) {
        await updateCourse(editTarget.courseId, payload);
        load(page);
      } else {
        await createCourse(payload);
        setPage(0);
        load(0);
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-black text-[#1a1a2e]">강의 관리</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-xs font-bold bg-[#4A90D9] hover:bg-[#3a7fc9] text-white rounded-xl transition-colors"
        >
          + 강의 등록
        </button>
      </div>

      {/* 검색 */}
      <input
        type="text"
        placeholder="강의명 또는 카테고리 검색"
        value={searchKw}
        onChange={(e) => setSearchKw(e.target.value)}
        className="w-full max-w-sm p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] bg-white"
      />

      {/* 테이블 */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">강의가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['강의명', '카테고리', '대상', '시간(분)', '상태', '등록일', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.courseId} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-semibold text-gray-700 max-w-[200px] truncate">{c.title}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold">
                        {c.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{TARGET_ROLE_LABELS[c.targetRole] ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{c.durationMin ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {c.active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {c.createdAt?.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => router.push(`/admin/courses/${c.courseId}`)}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-[#1a1a2e]/10 hover:bg-[#1a1a2e]/20 text-[#1a1a2e] rounded-lg transition-colors"
                        >
                          구성
                        </button>
                        <button
                          onClick={() => setRoundCourse(c)}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-[#4A90D9]/10 hover:bg-[#4A90D9]/20 text-[#4A90D9] rounded-lg transition-colors"
                        >
                          차수
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(c.courseId)}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 border-t border-gray-50">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalElements={totalElements}
            size={PAGE_SIZE}
            onChange={handlePageChange}
          />
        </div>
      </div>

      {/* Course edit/create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-[#1a1a2e]">
                {editTarget ? '강의 수정' : '강의 등록'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500">강의명 *</label>
                <input
                  required
                  type="text"
                  className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9]"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500">설명</label>
                <textarea
                  rows={3}
                  className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] resize-none"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500">카테고리</label>
                  <select
                    className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] bg-white"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500">대상 직군</label>
                  <select
                    className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] bg-white"
                    value={form.targetRole}
                    onChange={(e) => setForm({ ...form, targetRole: Number(e.target.value) })}
                  >
                    <option value={0}>전체</option>
                    <option value={1}>현장직</option>
                    <option value={2}>사무직</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500">총 시간 (분)</label>
                  <input
                    type="number"
                    min={1}
                    className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9]"
                    value={form.durationMin ?? ''}
                    onChange={(e) => setForm({ ...form, durationMin: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500">썸네일 URL</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9]"
                    value={form.thumbnailUrl ?? ''}
                    onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
                  />
                </div>
              </div>

              {formError && (
                <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {formError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
        </div>
      )}

      {/* Round management modal */}
      {roundCourse && (
        <RoundModal course={roundCourse} onClose={() => setRoundCourse(null)} />
      )}
    </div>
  );
}
