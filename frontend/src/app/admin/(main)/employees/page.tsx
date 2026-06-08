'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  getEmployeesPaged, createEmployee, updateEmployee, deleteEmployee,
  getDepartments, exportEmployeesExcel, getEnrollmentsByUser,
  EmployeeResponse, EmployeeRequest, Department,
} from '@/api/adminApi';
import Pagination from '@/components/admin/Pagination';

import { downloadBlob } from '@/lib/utils';

const EMPTY_FORM: EmployeeRequest = {
  employeeNo: '', name: '', email: '', departmentId: 0,
  position: '', empType: 0, phone: '', hireDate: '', role: 'ROLE_USER',
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 20;

  // 직원 CRUD 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeResponse | null>(null);
  const [form, setForm] = useState<EmployeeRequest>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // 수강현황 모달
  const [enrollTarget, setEnrollTarget] = useState<EmployeeResponse | null>(null);
  const [enrollments, setEnrollments] = useState<import('@/api/adminApi').EnrollmentResponse[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(false);

  const openEnrollModal = async (emp: EmployeeResponse) => {
    setEnrollTarget(emp);
    setEnrollLoading(true);
    getEnrollmentsByUser(emp.userId).then(setEnrollments).catch(() => setEnrollments([])).finally(() => setEnrollLoading(false));
  };

  const load = useCallback(async (kw?: string, p = 0) => {
    setLoading(true);
    try {
      const [result, depts] = await Promise.all([
        getEmployeesPaged(kw, p, PAGE_SIZE),
        getDepartments(),
      ]);
      setEmployees(result.content);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
      setDepartments(depts);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePageChange = (p: number) => {
    setPage(p);
    load(keyword || undefined, p);
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (emp: EmployeeResponse) => {
    setEditTarget(emp);
    setForm({
      employeeNo: emp.employeeNo,
      name: emp.name,
      email: emp.email,
      departmentId: emp.departmentId ?? 0,
      position: emp.position,
      empType: emp.empType,
      phone: emp.phone ?? '',
      hireDate: emp.hireDate,
      role: emp.role,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('직원을 삭제하시겠습니까?')) return;
    try {
      await deleteEmployee(id);
      load(keyword || undefined, page);
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.employeeNo || !form.name || !form.email || !form.hireDate) {
      setFormError('필수 항목을 모두 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        await updateEmployee(editTarget.userId, form);
        load(keyword || undefined, page);
      } else {
        await createEmployee(form);
        setPage(0);
        load(keyword || undefined, 0);
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportEmployeesExcel(keyword || undefined);
      downloadBlob(blob, `employees_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch { alert('엑셀 내보내기 실패'); }
    setExporting(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    load(keyword || undefined, 0);
  };

  const STATUS_COLOR_MAP: Record<string, string> = { IN_PROGRESS: 'bg-blue-50 text-blue-600', DONE: 'bg-emerald-50 text-emerald-600', NOT_STARTED: 'bg-yellow-50 text-yellow-500' };
  const STATUS_LABEL_MAP: Record<string, string> = { IN_PROGRESS: '수강 중', DONE: '이수 완료', NOT_STARTED: '미시작' };

  return (
    <div className="flex flex-col gap-5">
      {/* 수강현황 모달 */}
      {enrollTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEnrollTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[80vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-400 font-semibold">{enrollTarget.employeeNo} · {enrollTarget.departmentName}</p>
                <h2 className="text-sm font-black text-[#111]">{enrollTarget.name}의 수강 현황</h2>
              </div>
              <button onClick={() => setEnrollTarget(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="px-5 py-4">
              {enrollLoading ? (
                <div className="py-8 text-center text-xs text-gray-400">불러오는 중...</div>
              ) : enrollments.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">수강 이력이 없습니다.</div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {enrollments.map((e) => (
                    <div key={e.enrollmentId} className="border border-gray-100 rounded-xl p-3.5 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-800 truncate">{e.courseTitle}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${STATUS_COLOR_MAP[e.status] ?? 'bg-gray-100 text-gray-400'}`}>
                          {STATUS_LABEL_MAP[e.status] ?? e.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-[#185FA5] h-full rounded-full" style={{ width: `${e.progress}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-gray-500 w-8 text-right">{e.progress}%</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-400">
                        <span>{e.roundNo}차</span>
                        <span>수강신청: {e.enrolledAt?.slice(0,10)}</span>
                        {e.completedAt && <span>이수: {e.completedAt.slice(0,10)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-black text-[#1a1a2e]">직원 관리</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-50 transition-colors"
          >
            {exporting ? '내보내는 중...' : '엑셀 내보내기'}
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 text-xs font-bold bg-[#4A90D9] hover:bg-[#3a7fc9] text-white rounded-xl transition-colors"
          >
            + 직원 등록
          </button>
        </div>
      </div>

      {/* 검색 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder="이름, 사번, 이메일 검색"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="flex-1 p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] bg-white"
        />
        <button
          type="submit"
          className="px-4 py-2 text-xs font-bold bg-[#1a1a2e] text-white rounded-xl hover:bg-[#2a2a4e] transition-colors"
        >
          검색
        </button>
      </form>

      {/* 테이블 */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : employees.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">직원이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['사번', '이름', '부서', '직급', '직군', '이메일', '입사일', '권한', '상태', '수강현황', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.userId} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-gray-600">{emp.employeeNo}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{emp.name}</td>
                    <td className="px-4 py-3 text-gray-500">{emp.departmentName ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{emp.position}</td>
                    <td className="px-4 py-3 text-gray-500">{emp.empType === 0 ? '사무직' : '현장직'}</td>
                    <td className="px-4 py-3 text-gray-500">{emp.email}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{emp.hireDate}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        emp.role === 'ROLE_ADMIN'
                          ? 'bg-purple-100 text-purple-600'
                          : 'bg-blue-50 text-blue-500'
                      }`}>
                        {emp.role === 'ROLE_ADMIN' ? '관리자' : '직원'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        emp.active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {emp.active ? '재직' : '퇴직'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEnrollModal(emp)}
                        className="px-2.5 py-1 text-[10px] font-semibold text-[#185FA5] border border-[#185FA5]/30 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap">
                        수강현황
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(emp)}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-[#1a1a2e]">
                {editTarget ? '직원 정보 수정' : '직원 등록'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500">사번 *</label>
                  <input
                    required
                    type="text"
                    placeholder="예: EMP001"
                    className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9]"
                    value={form.employeeNo}
                    onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
                    disabled={!!editTarget}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500">이름 *</label>
                  <input
                    required
                    type="text"
                    className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9]"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500">이메일 *</label>
                <input
                  required
                  type="email"
                  className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9]"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500">부서 *</label>
                  <select
                    required
                    className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] bg-white"
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: Number(e.target.value) })}
                  >
                    <option value={0}>부서 선택</option>
                    {departments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500">직급 *</label>
                  <input
                    required
                    type="text"
                    placeholder="예: 사원"
                    className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9]"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500">직군</label>
                  <select
                    className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] bg-white"
                    value={form.empType}
                    onChange={(e) => setForm({ ...form, empType: Number(e.target.value) })}
                  >
                    <option value={0}>사무직</option>
                    <option value={1}>현장직</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500">권한</label>
                  <select
                    className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] bg-white"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="ROLE_USER">직원</option>
                    <option value="ROLE_ADMIN">관리자</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500">전화번호</label>
                  <input
                    type="text"
                    placeholder="010-0000-0000"
                    className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9]"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500">입사일 *</label>
                  <input
                    required
                    type="date"
                    className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9]"
                    value={form.hireDate}
                    onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
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
    </div>
  );
}
