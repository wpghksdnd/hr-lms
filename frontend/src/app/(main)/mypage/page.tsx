'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMypage, getMyCertificates, downloadCertificate } from '@/api/mypage';
import { getEnrollmentHistory } from '@/api/myLearning';
import { changePassword } from '@/api/auth';
import type { MypageResponse, CertificateResponse, EnrollmentHistoryItem } from '@/api/types';

const STATUS_STYLE: Record<string, { label: string; color: string; bar: string }> = {
  IN_PROGRESS: { label: '수강 중',   color: 'text-blue-600',    bar: 'bg-[#185FA5]' },
  DONE:        { label: '이수 완료', color: 'text-emerald-600', bar: 'bg-emerald-500' },
  NOT_STARTED: { label: '미시작',    color: 'text-yellow-600',  bar: 'bg-yellow-400' },
};

export default function MypagePage() {
  const [mypage, setMypage] = useState<MypageResponse | null>(null);
  const [certs, setCerts] = useState<CertificateResponse[]>([]);
  const [history, setHistory] = useState<EnrollmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'certs' | 'history'>('certs');

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    Promise.all([getMypage(), getMyCertificates(), getEnrollmentHistory()])
      .then(([m, c, h]) => { setMypage(m); setCerts(c); setHistory(h); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePwChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwNext !== pwConfirm) { setPwMsg('새 비밀번호가 일치하지 않습니다.'); return; }
    if (pwNext.length < 8) { setPwMsg('비밀번호는 8자 이상이어야 합니다.'); return; }
    try {
      await changePassword({ currentPassword: pwCurrent, newPassword: pwNext });
      setPwMsg('비밀번호가 변경되었습니다.');
      setPwCurrent(''); setPwNext(''); setPwConfirm('');
    } catch {
      setPwMsg('변경 실패. 현재 비밀번호를 확인해 주세요.');
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-xs text-gray-400">불러오는 중...</div>;

  const inProgressCount = history.filter((h) => h.status === 'IN_PROGRESS').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-5">
      <div className="flex flex-col gap-5">
        {/* 내 정보 카드 */}
        <div className="bg-white p-5 border border-black/[0.06] rounded-xl shadow-sm">
          {mypage && (
            <>
              <h4 className="font-bold text-base mb-3">👤 내 정보</h4>
              <div className="grid grid-cols-2 gap-y-2 text-xs mb-4 pb-4 border-b border-gray-100">
                <span className="text-gray-400">이름</span><span className="font-medium">{mypage.name}</span>
                <span className="text-gray-400">사원번호</span><span>{mypage.employeeNo}</span>
                <span className="text-gray-400">부서</span><span>{mypage.departmentName}</span>
                <span className="text-gray-400">직위</span><span>{mypage.position}</span>
              </div>
              {/* 통계 요약 */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '수강 중', value: inProgressCount, color: 'text-blue-600' },
                  { label: '이수 완료', value: mypage.completedCoursesCount, color: 'text-emerald-600' },
                  { label: '전체 이수율', value: `${Math.round(mypage.overallCompletionRate ?? 0)}%`, color: 'text-[#185FA5]' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className={`text-xl font-black ${color}`}>{value}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 수료증 / 수강 이력 탭 */}
        <div className="bg-white p-5 border border-black/[0.06] rounded-xl shadow-sm flex flex-col gap-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {([['certs', `🏅 수료증 (${certs.length})`], ['history', `📚 수강 이력 (${history.length})`]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setActiveSection(k)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeSection === k ? 'bg-white shadow-sm text-[#185FA5]' : 'text-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>

          {activeSection === 'certs' ? (
            <div className="flex flex-col gap-3">
              {certs.length === 0 ? (
                <div className="text-xs text-gray-400 py-6 text-center">아직 수료한 강좌가 없습니다.</div>
              ) : (
                certs.map((cert) => (
                  <div key={cert.certificateId} className="flex justify-between items-center p-3 border border-black/[0.04] bg-gray-50/50 rounded-lg">
                    <div>
                      <div className="font-semibold text-xs sm:text-sm">{cert.courseTitle}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(cert.issuedAt).toLocaleDateString('ko-KR')} 발급
                      </div>
                    </div>
                    <button onClick={() => downloadCertificate(cert.certificateId)}
                      className="text-[11px] bg-white border border-black/10 px-2.5 py-1.5 rounded-md text-gray-600 font-medium hover:bg-gray-50">
                      ⬇ 다운로드
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {history.length === 0 ? (
                <div className="text-xs text-gray-400 py-6 text-center">
                  수강 이력이 없습니다.
                  <Link href="/courses" className="block mt-2 text-[#185FA5] font-semibold">수강신청 하러 가기 →</Link>
                </div>
              ) : (
                history.map((h) => {
                  const style = STATUS_STYLE[h.status] ?? { label: h.status, color: 'text-gray-400', bar: 'bg-gray-300' };
                  return (
                    <div key={h.enrollmentId} className="border border-black/[0.04] bg-gray-50/50 rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-xs text-[#222] truncate">{h.courseTitle}</div>
                        <span className={`text-[10px] font-bold shrink-0 ${style.color}`}>{style.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${h.progress}%` }} />
                        </div>
                        <span className="text-[11px] text-gray-500 w-7 text-right">{h.progress}%</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-400">
                        <span>{h.roundNo}차</span>
                        <span>수강: {h.enrolledAt?.slice(0,10)}</span>
                        {h.completedAt && <span className="text-emerald-500 font-semibold">이수: {h.completedAt.slice(0,10)}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* 비밀번호 변경 */}
      <div className="bg-white p-5 border border-black/[0.06] rounded-xl shadow-sm flex flex-col gap-3 h-fit">
        <Link
          href="/notifications"
          className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-[#185FA5] transition-colors hover:bg-blue-100"
        >
          <span>🔔 알림함</span>
          <span>전체보기</span>
        </Link>
        <h4 className="font-bold text-sm text-gray-800">🔒 비밀번호 변경</h4>
        <form onSubmit={handlePwChange} className="flex flex-col gap-3">
          <input type="password" placeholder="현재 비밀번호" required
            className="w-full p-2 text-xs border border-black/10 rounded-md outline-none focus:border-[#185FA5]"
            value={pwCurrent} onChange={(e) => { setPwCurrent(e.target.value); setPwMsg(''); }} />
          <input type="password" placeholder="새 비밀번호 (8자 이상)" required
            className="w-full p-2 text-xs border border-black/10 rounded-md outline-none focus:border-[#185FA5]"
            value={pwNext} onChange={(e) => { setPwNext(e.target.value); setPwMsg(''); }} />
          <input type="password" placeholder="새 비밀번호 확인" required
            className="w-full p-2 text-xs border border-black/10 rounded-md outline-none focus:border-[#185FA5]"
            value={pwConfirm} onChange={(e) => { setPwConfirm(e.target.value); setPwMsg(''); }} />
          {pwMsg && (
            <div className={`text-xs px-3 py-2 rounded-lg border ${pwMsg.includes('변경되었습니다') ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-red-500 bg-red-50 border-red-100'}`}>
              {pwMsg}
            </div>
          )}
          <button type="submit" className="w-full py-2 bg-[#185FA5] text-white text-xs font-bold rounded-md hover:bg-[#144f8b] transition-colors">
            변경 적용하기
          </button>
        </form>
      </div>
    </div>
  );
}
