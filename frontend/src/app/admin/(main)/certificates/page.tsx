'use client';
import { useEffect, useState } from 'react';
import {
  getAdminCertificates, generateCertificateManual, deleteAdminCertificate,
  getEmployees,
  getAdminCourses,
} from '@/api/adminApi';
import type { AdminCertificateItem } from '@/api/types';

export default function AdminCertificatesPage() {
  const [certs, setCerts] = useState<AdminCertificateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // 수동 발급 폼
  const [showGenForm, setShowGenForm] = useState(false);
  const [employees, setEmployees] = useState<{ userId: number; name: string; employeeNo: string }[]>([]);
  const [courses, setCourses] = useState<{ courseId: number; title: string }[]>([]);
  const [genUserId, setGenUserId] = useState('');
  const [genCourseId, setGenCourseId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState('');

  const load = () => {
    setLoading(true);
    getAdminCertificates().then(setCerts).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    getEmployees().then((list) => setEmployees(list.map((e) => ({ userId: e.userId, name: e.name, employeeNo: e.employeeNo })))).catch(() => {});
    getAdminCourses().then((list) => setCourses(list.map((c) => ({ courseId: c.courseId, title: c.title })))).catch(() => {});
  }, []);

  const handleDelete = async (id: number, name: string, title: string) => {
    if (!confirm(`${name}의 "${title}" 이수증을 삭제하시겠습니까?`)) return;
    await deleteAdminCertificate(id).catch(() => alert('삭제 실패'));
    load();
  };

  const handleGenerate = async () => {
    if (!genUserId || !genCourseId) { setGenMsg('직원과 강좌를 선택해 주세요.'); return; }
    setGenerating(true); setGenMsg('');
    try {
      const res = await generateCertificateManual(Number(genUserId), Number(genCourseId));
      setGenMsg(res.message ?? '발급 완료');
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setGenMsg(msg ?? '발급 실패');
    } finally { setGenerating(false); }
  };

  const filtered = certs.filter((c) =>
    !query || c.userName.includes(query) || c.employeeNo.includes(query) || c.courseTitle.includes(query)
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#111]">이수증 관리</h1>
          <p className="text-xs text-gray-400 mt-0.5">발급된 이수증 목록을 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white border border-black/[0.06] rounded-xl px-4 py-2 text-center shadow-sm">
            <div className="text-lg font-black text-[#185FA5]">{certs.length}</div>
            <div className="text-[10px] text-gray-400">총 발급</div>
          </div>
          <button onClick={() => { setShowGenForm((v) => !v); setGenMsg(''); }}
            className="px-4 py-2 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b]">
            {showGenForm ? '닫기' : '+ 수동 발급'}
          </button>
        </div>
      </div>

      {/* 수동 발급 폼 */}
      {showGenForm && (
        <div className="bg-white border border-black/[0.06] rounded-xl p-5 shadow-sm flex flex-col gap-3">
          <h3 className="text-sm font-bold text-gray-700">수동 이수증 발급</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 block mb-1">직원 선택</label>
              <select value={genUserId} onChange={(e) => setGenUserId(e.target.value)}
                className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#185FA5]">
                <option value="">-- 직원 선택 --</option>
                {employees.map((emp) => (
                  <option key={emp.userId} value={emp.userId}>{emp.name} ({emp.employeeNo})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 block mb-1">강좌 선택</label>
              <select value={genCourseId} onChange={(e) => setGenCourseId(e.target.value)}
                className="w-full p-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#185FA5]">
                <option value="">-- 강좌 선택 --</option>
                {courses.map((c) => (
                  <option key={c.courseId} value={c.courseId}>{c.title}</option>
                ))}
              </select>
            </div>
          </div>
          {genMsg && (
            <div className={`text-xs px-3 py-2 rounded-lg ${genMsg.includes('실패') || genMsg.includes('선택') ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
              {genMsg}
            </div>
          )}
          <button onClick={handleGenerate} disabled={generating}
            className="w-full py-2 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b] disabled:bg-gray-300">
            {generating ? '발급 중...' : '이수증 발급'}
          </button>
        </div>
      )}

      {/* 검색 */}
      <input value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="직원명, 사번, 강좌명 검색..."
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100" />

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-xs text-gray-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-black/[0.06] rounded-xl p-12 text-center text-gray-400 text-sm">
          발급된 이수증이 없습니다.
        </div>
      ) : (
        <div className="bg-white border border-black/[0.06] rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-black/[0.06]">
              <tr>
                {['사번', '직원명', '부서', '강좌', '차수', '발급일', '관리'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-bold text-gray-500 text-[11px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.certificateId} className="border-b border-black/[0.04] hover:bg-gray-50/50 transition-colors">
                  <td className="px-3 py-2.5 text-gray-500">{c.employeeNo}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-800">{c.userName}</td>
                  <td className="px-3 py-2.5 text-gray-500">{c.departmentName ?? '-'}</td>
                  <td className="px-3 py-2.5 text-gray-700 max-w-[180px] truncate">{c.courseTitle}</td>
                  <td className="px-3 py-2.5 text-gray-500">{c.roundNo}차</td>
                  <td className="px-3 py-2.5 text-gray-500">{c.issuedAt}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => handleDelete(c.certificateId, c.userName, c.courseTitle)}
                      className="text-[10px] text-red-400 hover:text-red-600 font-semibold">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
