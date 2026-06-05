'use client';
import React, { useEffect, useState } from 'react';
import { getAdminDashboard, AdminDashboardResponse } from '@/api/adminApi';

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-sm">
      <div className="text-xs font-semibold text-gray-400 mb-1">{label}</div>
      <div className={`text-3xl font-black ${color ?? 'text-[#1a1a2e]'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminDashboard()
      .then(setData)
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>;
  if (error)   return <div className="py-20 text-center text-sm text-red-400">{error}</div>;
  if (!data)   return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-black text-[#1a1a2e]">대시보드</h1>

      {/* 상단 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="전체 직원" value={data.totalEmployees} sub="명" />
        <StatCard label="전체 강의" value={data.totalCourses} sub="개" />
        <StatCard
          label="미이수자"
          value={data.notCompletedCount}
          sub="명"
          color="text-red-500"
        />
        <StatCard
          label="전체 이수율"
          value={`${data.overallCompletionRate.toFixed(1)}%`}
          color="text-[#4A90D9]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 부서별 이수율 */}
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#1a1a2e] mb-4">부서별 이수율</h2>
          {data.deptStats.length === 0 ? (
            <p className="text-xs text-gray-400">데이터 없음</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.deptStats.map((d, i) => (
                <div key={`${d.dept}-${i}`}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{d.dept}</span>
                    <span className="font-bold text-[#1a1a2e]">{d.completionRate.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#4A90D9] rounded-full transition-all"
                      style={{ width: `${Math.min(d.completionRate, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 마감 임박 강의 */}
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#1a1a2e] mb-4">마감 임박 강의</h2>
          {data.deadlineAlerts.length === 0 ? (
            <p className="text-xs text-gray-400">임박한 마감 강의 없음</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.deadlineAlerts.map((a, i) => (
                <div
                  key={`${a.courseId}-${i}`}
                  className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-xl"
                >
                  <div>
                    <div className="text-xs font-bold text-gray-700">{a.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">마감: {a.deadline}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-orange-500">{a.notCompletedCount}명</div>
                    <div className="text-[10px] text-gray-400">미이수</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 미이수자 목록 */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
        <h2 className="text-sm font-bold text-[#1a1a2e] mb-4">이수율 하위 직원</h2>
        {data.lowProgressList.length === 0 ? (
          <p className="text-xs text-gray-400">해당 없음</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left font-semibold text-gray-400">이름</th>
                  <th className="pb-2 text-left font-semibold text-gray-400">부서</th>
                  <th className="pb-2 text-left font-semibold text-gray-400">직군</th>
                  <th className="pb-2 text-right font-semibold text-gray-400">이수율</th>
                </tr>
              </thead>
              <tbody>
                {data.lowProgressList.map((p, i) => (
                  <tr key={`${p.userId}-${i}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 font-medium text-gray-700">{p.name}</td>
                    <td className="py-2 text-gray-500">{p.department}</td>
                    <td className="py-2 text-gray-500">
                      {p.role === 'ROLE_ADMIN' ? '관리자' : '일반'}
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={`font-bold ${
                          p.completionRate < 50 ? 'text-red-500' : 'text-yellow-500'
                        }`}
                      >
                        {p.completionRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
