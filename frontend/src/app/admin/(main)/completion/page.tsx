'use client';
import React, { useEffect, useState } from 'react';
import {
  getEnrollmentsPaged, getPendingEnrollments, approveEnrollment, rejectEnrollment,
  exportEnrollmentsExcel, getEnrollmentStatistics, getEnrollmentProgress,
  EnrollmentResponse, EnrollmentFilter, EnrollmentStatistics,
} from '@/api/adminApi';
import type { UserVideoProgress } from '@/api/types';
import { downloadBlob } from '@/lib/utils';
import Pagination from '@/components/admin/Pagination';

const STATUS_LABEL: Record<string, string> = { IN_PROGRESS: '수강 중', COMPLETED: '이수 완료', DONE: '이수 완료', DROPPED: '중도 취소', NOT_STARTED: '미시작' };
const APPROVAL_LABEL: Record<string, string> = { PENDING: '승인 대기', APPROVED: '승인', REJECTED: '반려' };
const APPROVAL_COLOR: Record<string, string> = { PENDING: 'bg-yellow-50 text-yellow-600', APPROVED: 'bg-green-50 text-green-600', REJECTED: 'bg-red-50 text-red-500' };
const STATUS_COLOR: Record<string, string> = { IN_PROGRESS: 'bg-blue-50 text-blue-500', COMPLETED: 'bg-green-50 text-green-600', DONE: 'bg-green-50 text-green-600', DROPPED: 'bg-gray-100 text-gray-400' };

// ── 영상 진도 모달 ─────────────────────────────────────────────────────────────
function VideoProgressModal({ enrollment, onClose }: { enrollment: EnrollmentResponse; onClose: () => void }) {
  const [progress, setProgress] = useState<UserVideoProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEnrollmentProgress(enrollment.enrollmentId)
      .then(setProgress)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enrollment.enrollmentId]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400 font-semibold">{enrollment.userName} · {enrollment.department}</p>
            <h2 className="text-sm font-black text-[#111]">{enrollment.courseTitle}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {loading ? (
            <div className="py-8 text-center text-xs text-gray-400">불러오는 중...</div>
          ) : !progress ? (
            <div className="py-8 text-center text-xs text-gray-400">진도 정보를 불러올 수 없습니다.</div>
          ) : (
            <>
              {/* 전체 진도 */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-700">전체 진도</span>
                    <span className="text-xs font-black text-[#185FA5]">{progress.enrollmentProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-[#185FA5] h-full rounded-full transition-all" style={{ width: `${progress.enrollmentProgress}%` }} />
                  </div>
                </div>
                <div className="text-[11px] text-gray-500 shrink-0">
                  {progress.completedLectures}/{progress.totalLectures} 단원
                </div>
              </div>

              {/* 단원별 상세 */}
              {progress.lectures?.map((lecture) => (
                <div key={lecture.lectureId} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className={`px-4 py-2.5 flex items-center justify-between ${lecture.completed ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                    <span className="text-xs font-bold text-gray-700">{lecture.lectureTitle}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${lecture.completed ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500'}`}>
                      {lecture.completed ? '완료' : '미완료'}
                    </span>
                  </div>
                  {lecture.videos?.map((v) => (
                    <div key={v.videoId} className="flex items-center justify-between px-4 py-2 border-t border-gray-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.completed ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                        <span className="text-[11px] text-gray-600 truncate">{v.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-gray-400">
                          {Math.floor(v.watchedSec / 60)}분 {v.watchedSec % 60}초
                          {v.durationSec > 0 && ` / ${Math.floor(v.durationSec / 60)}분 ${v.durationSec % 60}초`}
                        </span>
                        {v.completed && <span className="text-[10px] text-emerald-500 font-bold">✓</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function CompletionPage() {
  const [tab, setTab] = useState<'all' | 'pending'>('all');
  const [enrollments, setEnrollments] = useState<EnrollmentResponse[]>([]);
  const [pending, setPending] = useState<EnrollmentResponse[]>([]);
  const [stats, setStats] = useState<EnrollmentStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [progressTarget, setProgressTarget] = useState<EnrollmentResponse | null>(null);

  const [filterDept, setFilterDept] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 20;

  const loadAll = async (params?: EnrollmentFilter, p = 0) => {
    setLoading(true);
    try {
      const [result, pend, s] = await Promise.all([
        getEnrollmentsPaged(params, p, PAGE_SIZE),
        getPendingEnrollments(),
        getEnrollmentStatistics(),
      ]);
      setEnrollments(result.content);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
      setPending(pend); setStats(s);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadAll({ dept: filterDept || undefined, category: filterCategory || undefined }, 0);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    loadAll({ dept: filterDept || undefined, category: filterCategory || undefined }, p);
  };

  const handleApprove = async (id: number) => {
    try {
      await approveEnrollment(id);
      setPending((prev) => prev.filter((e) => e.enrollmentId !== id));
      loadAll({ dept: filterDept || undefined, category: filterCategory || undefined }, page);
    } catch { alert('승인 처리 실패'); }
  };

  const handleReject = async (id: number) => {
    if (!confirm('신청을 반려하시겠습니까?')) return;
    try {
      await rejectEnrollment(id);
      setPending((prev) => prev.filter((e) => e.enrollmentId !== id));
    } catch { alert('반려 처리 실패'); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportEnrollmentsExcel({ dept: filterDept || undefined, category: filterCategory || undefined });
      downloadBlob(blob, `이수현황_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch { alert('엑셀 내보내기 실패'); }
    setExporting(false);
  };

  const displayed = (tab === 'pending' ? pending : enrollments).filter((e) => {
    if (searchKw && !e.userName.includes(searchKw) && !e.courseTitle.includes(searchKw) && !e.department.includes(searchKw)) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  const completionRate = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      {progressTarget && <VideoProgressModal enrollment={progressTarget} onClose={() => setProgressTarget(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-black text-[#1a1a2e]">이수 현황</h1>
        <button onClick={handleExport} disabled={exporting}
          className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-50 transition-colors">
          {exporting ? '내보내는 중...' : '엑셀 내보내기'}
        </button>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '전체 수강', value: stats.total, color: 'text-gray-700', bg: 'bg-white' },
            { label: '수강 중', value: stats.inProgress, color: 'text-blue-600', bg: 'bg-blue-50/50' },
            { label: '이수 완료', value: stats.completed, color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
            { label: '이수율', value: `${completionRate}%`, color: 'text-[#185FA5]', bg: 'bg-[#E6F1FB]/50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} border border-black/[0.06] rounded-xl p-4 text-center shadow-sm`}>
              <div className={`text-2xl font-black ${color}`}>{value}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'all', label: '전체 이수 현황' },
          { key: 'pending', label: `승인 대기 ${pending.length > 0 ? `(${pending.length})` : ''}` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key as 'all' | 'pending')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${tab === key ? 'bg-white shadow-sm text-[#1a1a2e]' : 'text-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* 필터 */}
      <form onSubmit={handleFilter} className="flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="이름, 강의명, 부서 검색" value={searchKw}
          onChange={(e) => setSearchKw(e.target.value)}
          className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] bg-white min-w-[180px]" />
        {tab === 'all' && (
          <>
            <input type="text" placeholder="부서명 필터" value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] bg-white w-32" />
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] bg-white">
              <option value="">전체 카테고리</option>
              <option value="법정의무교육">법정의무교육</option>
              <option value="직무교육">직무교육</option>
              <option value="안전교육">안전교육</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="p-2.5 text-xs border border-black/10 rounded-xl outline-none focus:border-[#4A90D9] bg-white">
              <option value="">전체 상태</option>
              <option value="IN_PROGRESS">수강 중</option>
              <option value="COMPLETED">이수 완료</option>
              <option value="DROPPED">중도 취소</option>
            </select>
            <button type="submit"
              className="px-4 py-2 text-xs font-bold bg-[#1a1a2e] text-white rounded-xl hover:bg-[#2a2a4e] transition-colors">
              적용
            </button>
          </>
        )}
      </form>

      {/* 테이블 */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">데이터가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {(tab === 'pending'
                    ? ['직원명', '부서', '강의명', '차수', '신청일', '처리']
                    : ['직원명', '부서', '강의명', '차수', '진행률', '상태', '승인', '이수일', '상세']
                  ).map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((e) => (
                  <tr key={e.enrollmentId} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">{e.userName}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{e.department || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{e.courseTitle}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{e.roundNo}차</td>
                    {tab === 'pending' ? (
                      <>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{e.enrolledAt?.slice(0, 10)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button onClick={() => handleApprove(e.enrollmentId)}
                              className="px-2.5 py-1 text-[10px] font-bold bg-[#4A90D9] text-white rounded-lg hover:bg-[#3a7fc9]">승인</button>
                            <button onClick={() => handleReject(e.enrollmentId)}
                              className="px-2.5 py-1 text-[10px] font-semibold bg-red-50 text-red-500 rounded-lg hover:bg-red-100">반려</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#4A90D9] rounded-full" style={{ width: `${e.progress}%` }} />
                            </div>
                            <span className="text-gray-600 font-semibold">{e.progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLOR[e.status] ?? 'bg-gray-100 text-gray-400'}`}>
                            {STATUS_LABEL[e.status] ?? e.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${APPROVAL_COLOR[e.approvalStatus] ?? 'bg-gray-100 text-gray-400'}`}>
                            {APPROVAL_LABEL[e.approvalStatus] ?? e.approvalStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                          {e.completedAt ? e.completedAt.slice(0, 10) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setProgressTarget(e)}
                            className="text-[10px] text-[#185FA5] font-semibold hover:underline whitespace-nowrap">
                            진도 상세
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'all' && (
          <div className="px-4 border-t border-gray-50">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              size={PAGE_SIZE}
              onChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
