'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  getEmployees, getEmployeesPaged, createEmployee, updateEmployee, deleteEmployee,
  getDepartments, exportEmployeesExcel, getEnrollmentsByUser,
  EmployeeResponse, EmployeeRequest, Department,
} from '@/api/adminApi';
import Pagination from '@/components/admin/Pagination';
import { downloadBlob } from '@/lib/utils';

const EMPTY_FORM: EmployeeRequest = {
  employeeNo: '', name: '', email: '', departmentId: 0,
  position: '', empType: 0, phone: '', hireDate: '', role: 'ROLE_USER',
};

const EMP_TYPE_TABS = [
  { label: '전체', value: -1 },
  { label: '사무직', value: 0 },
  { label: '현장직', value: 1 },
];

const STATUS_COLOR_MAP: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-50 text-blue-600',
  DONE: 'bg-emerald-50 text-emerald-600',
  NOT_STARTED: 'bg-yellow-50 text-yellow-500',
};
const STATUS_LABEL_MAP: Record<string, string> = {
  IN_PROGRESS: '수강 중', DONE: '이수 완료', NOT_STARTED: '미시작',
};

export default function EmployeesPage() {
  const [allEmployees, setAllEmployees] = useState<EmployeeResponse[]>([]);
  const [pagedEmployees, setPagedEmployees] = useState<EmployeeResponse[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [keyword, setKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const [deptFilter, setDeptFilter] = useState<number>(-1);   // -1 = 전체
  const [empTypeFilter, setEmpTypeFilter] = useState<number>(-1); // -1 = 전체

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // pagination (필터 없을 때만)
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 20;

  // CRUD modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeResponse | null>(null);
  const [form, setForm] = useState<EmployeeRequest>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // 수강현황 modal
  const [enrollTarget, setEnrollTarget] = useState<EmployeeResponse | null>(null);
  const [enrollments, setEnrollments] = useState<import('@/api/adminApi').EnrollmentResponse[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(false);

  /* 필터가 활성화되었는지 여부 */
  const hasFilter = deptFilter !== -1 || empTypeFilter !== -1;

  /* ── 데이터 로드 ── */
  const loadDepts = useCallback(async () => {
    try { setDepartments(await getDepartments()); } catch { /* ignore */ }
  }, []);

  /* 필터 없음 → 페이지네이션 API */
  const loadPaged = useCallback(async (kw: string, p: number) => {
    setLoading(true);
    try {
      const result = await getEmployeesPaged(kw || undefined, p, PAGE_SIZE);
      setPagedEmployees(result.content);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  /* 필터 있음 → 전체 로드 후 클라이언트 필터링 */
  const loadAll = useCallback(async (kw: string) => {
    setLoading(true);
    try {
      const result = await getEmployees(kw || undefined);
      setAllEmployees(result);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadDepts(); }, [loadDepts]);

  useEffect(() => {
    if (hasFilter) {
      loadAll(submittedKeyword);
    } else {
      loadPaged(submittedKeyword, page);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFilter, submittedKeyword, page]);

  /* 클라이언트 필터 적용 */
  const filteredEmployees = hasFilter
    ? allEmployees.filter((e) => {
        if (deptFilter !== -1 && e.departmentId !== deptFilter) return false;
        if (empTypeFilter !== -1 && e.empType !== empTypeFilter) return false;
        return true;
      })
    : pagedEmployees;

  const displayEmployees = filteredEmployees;
  const displayTotal = hasFilter ? filteredEmployees.length : totalElements;

  /* ── 핸들러 ── */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSubmittedKeyword(keyword);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
  };

  const handleDeptFilter = (id: number) => {
    setDeptFilter(id);
    setPage(0);
  };

  const handleEmpTypeFilter = (v: number) => {
    setEmpTypeFilter(v);
    setPage(0);
  };

  const resetFilters = () => {
    setDeptFilter(-1);
    setEmpTypeFilter(-1);
    setPage(0);
  };

  const openCreate = () => {
    setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setModalOpen(true);
  };
  const openEdit = (emp: EmployeeResponse) => {
    setEditTarget(emp);
    setForm({ employeeNo: emp.employeeNo, name: emp.name, email: emp.email,
      departmentId: emp.departmentId ?? 0, position: emp.position,
      empType: emp.empType, phone: emp.phone ?? '', hireDate: emp.hireDate, role: emp.role });
    setFormError(''); setModalOpen(true);
  };
  const handleDelete = async (id: number) => {
    if (!confirm('직원을 삭제하시겠습니까?')) return;
    try {
      await deleteEmployee(id);
      if (hasFilter) loadAll(submittedKeyword);
      else loadPaged(submittedKeyword, page);
    } catch { alert('삭제에 실패했습니다.'); }
  };
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!form.employeeNo || !form.name || !form.email || !form.hireDate) {
      setFormError('필수 항목을 모두 입력하세요.'); return;
    }
    setSaving(true);
    try {
      if (editTarget) await updateEmployee(editTarget.userId, form);
      else { await createEmployee(form); setPage(0); }
      setModalOpen(false);
      if (hasFilter) loadAll(submittedKeyword);
      else loadPaged(submittedKeyword, page);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? '저장에 실패했습니다.');
    } finally { setSaving(false); }
  };
  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportEmployeesExcel(submittedKeyword || undefined);
      downloadBlob(blob, `employees_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { alert('엑셀 내보내기 실패'); }
    setExporting(false);
  };
  const openEnrollModal = (emp: EmployeeResponse) => {
    setEnrollTarget(emp); setEnrollLoading(true);
    getEnrollmentsByUser(emp.userId).then(setEnrollments).catch(() => setEnrollments([]))
      .finally(() => setEnrollLoading(false));
  };

  return (
    <div className="flex flex-col gap-5">

      {/* ── 수강현황 모달 ── */}
      {enrollTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setEnrollTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[80vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold">{enrollTarget.employeeNo} · {enrollTarget.departmentName}</p>
                <h2 className="text-sm font-black text-slate-800">{enrollTarget.name}의 수강 현황</h2>
              </div>
              <button onClick={() => setEnrollTarget(null)} className="text-slate-400 hover:text-slate-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-lg">✕</button>
            </div>
            <div className="px-5 py-4">
              {enrollLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">불러오는 중...</div>
              ) : enrollments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">수강 이력이 없습니다.</div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {enrollments.map((e) => (
                    <div key={e.enrollmentId} className="border border-slate-100 rounded-xl p-3.5 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">{e.courseTitle}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${STATUS_COLOR_MAP[e.status] ?? 'bg-slate-100 text-slate-400'}`}>
                          {STATUS_LABEL_MAP[e.status] ?? e.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${e.progress}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 w-8 text-right">{e.progress}%</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        <span>{e.roundNo}차</span>
                        <span>수강신청: {e.enrolledAt?.slice(0, 10)}</span>
                        {e.completedAt && <span>이수: {e.completedAt.slice(0, 10)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 페이지 헤더 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">직원 관리</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            총 <span className="font-bold text-slate-600">{displayTotal}</span>명
            {hasFilter && <span className="ml-1 text-blue-500 font-semibold">(필터 적용 중)</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 transition-colors shadow-sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exporting ? '내보내는 중...' : '엑셀 내보내기'}
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl transition-colors shadow-sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            직원 등록
          </button>
        </div>
      </div>

      {/* ── 검색 ── */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="이름, 사번, 이메일 검색"
            value={keyword} onChange={(e) => setKeyword(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10 bg-white shadow-sm transition-all" />
        </div>
        <button type="submit"
          className="px-4 py-2 text-xs font-bold bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors shadow-sm">
          검색
        </button>
      </form>

      {/* ── 필터 패널 ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">

        {/* 직군 필터 */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 w-12 shrink-0">직군</span>
          <div className="flex gap-1.5 flex-wrap">
            {EMP_TYPE_TABS.map(({ label, value }) => (
              <button key={value} onClick={() => handleEmpTypeFilter(value)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  empTypeFilter === value
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 부서 필터 */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 w-12 shrink-0">부서</span>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => handleDeptFilter(-1)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                deptFilter === -1
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}>
              전체
            </button>
            {departments.map((d) => (
              <button key={d.departmentId} onClick={() => handleDeptFilter(d.departmentId)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  deptFilter === d.departmentId
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}>
                {d.name}
              </button>
            ))}
          </div>
        </div>

        {/* 필터 초기화 */}
        {hasFilter && (
          <div className="flex justify-end">
            <button onClick={resetFilters}
              className="text-[11px] text-slate-400 hover:text-red-500 font-semibold flex items-center gap-1 transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              필터 초기화
            </button>
          </div>
        )}
      </div>

      {/* ── 직원 테이블 ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <svg className="animate-spin text-blue-400 mx-auto" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        ) : displayEmployees.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-3xl mb-2">🔍</div>
            <p className="text-sm text-slate-400">검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['사번', '이름', '부서', '직급', '직군', '이메일', '입사일', '권한', '상태', '수강현황', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayEmployees.map((emp) => (
                  <tr key={emp.userId} className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">{emp.employeeNo}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{emp.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {emp.departmentName ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {emp.departmentName}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{emp.position}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        emp.empType === 0 ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                      }`}>
                        {emp.empType === 0 ? '사무직' : '현장직'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{emp.email}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{emp.hireDate}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        emp.role === 'ROLE_ADMIN' ? 'bg-purple-100 text-purple-600' : 'bg-blue-50 text-blue-500'
                      }`}>
                        {emp.role === 'ROLE_ADMIN' ? '관리자' : '직원'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        emp.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {emp.active ? '재직' : '퇴직'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button onClick={() => openEnrollModal(emp)}
                        className="px-2.5 py-1 text-[10px] font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors">
                        수강현황
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(emp)}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
                          수정
                        </button>
                        <button onClick={() => handleDelete(emp.userId)}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors">
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

        {/* 페이지네이션 — 필터 없을 때만 */}
        {!hasFilter && (
          <div className="px-4 border-t border-slate-50">
            <Pagination page={page} totalPages={totalPages} totalElements={totalElements}
              size={PAGE_SIZE} onChange={handlePageChange} />
          </div>
        )}
        {hasFilter && (
          <div className="px-4 py-3 border-t border-slate-50 text-xs text-slate-400 text-center">
            필터 적용 결과 {filteredEmployees.length}명 표시 중
          </div>
        )}
      </div>

      {/* ── 직원 등록/수정 모달 ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-800">{editTarget ? '직원 정보 수정' : '직원 등록'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-5 flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">사번 *</label>
                  <input required type="text" placeholder="예: EMP001"
                    className="p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10 transition-all"
                    value={form.employeeNo} onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
                    disabled={!!editTarget} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">이름 *</label>
                  <input required type="text"
                    className="p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10 transition-all"
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">이메일 *</label>
                <input required type="email"
                  className="p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10 transition-all"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">부서 *</label>
                  <select required
                    className="p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white transition-all"
                    value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: Number(e.target.value) })}>
                    <option value={0}>부서 선택</option>
                    {departments.map((d) => <option key={d.departmentId} value={d.departmentId}>{d.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">직급 *</label>
                  <input required type="text" placeholder="예: 사원"
                    className="p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10 transition-all"
                    value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">직군</label>
                  <select className="p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white transition-all"
                    value={form.empType} onChange={(e) => setForm({ ...form, empType: Number(e.target.value) })}>
                    <option value={0}>사무직</option>
                    <option value={1}>현장직</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">권한</label>
                  <select className="p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white transition-all"
                    value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="ROLE_USER">직원</option>
                    <option value="ROLE_ADMIN">관리자</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">전화번호</label>
                  <input type="text" placeholder="010-0000-0000"
                    className="p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10 transition-all"
                    value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">입사일 *</label>
                  <input required type="date"
                    className="p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10 transition-all"
                    value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} />
                </div>
              </div>
              {formError && (
                <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {formError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                  취소
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 text-xs font-bold bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-slate-300 text-white rounded-xl transition-colors shadow-sm">
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
