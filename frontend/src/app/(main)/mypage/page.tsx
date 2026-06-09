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

const CATEGORY_COLOR: Record<string, string> = {
  '법정의무교육': 'bg-blue-50 text-blue-600',
  '직무교육':    'bg-purple-50 text-purple-600',
};

export default function MypagePage() {
  const [mypage, setMypage] = useState<MypageResponse | null>(null);
  const [certs, setCerts] = useState<CertificateResponse[]>([]);
  const [history, setHistory] = useState<EnrollmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'certs' | 'history'>('certs');
  const [downloading, setDownloading] = useState<number | null>(null);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    Promise.allSettled([getMypage(), getMyCertificates(), getEnrollmentHistory()])
      .then(([m, c, h]) => {
        if (m.status === 'fulfilled') setMypage(m.value);
        if (c.status === 'fulfilled') setCerts(c.value);
        if (h.status === 'fulfilled') setHistory(h.value);
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePwChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwNext !== pwConfirm) { setPwMsg('새 비밀번호가 일치하지 않습니다.'); setPwSuccess(false); return; }
    if (pwNext.length < 8) { setPwMsg('비밀번호는 8자 이상이어야 합니다.'); setPwSuccess(false); return; }
    if (!/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':,.<>?])/.test(pwNext)) {
      setPwMsg('대문자·소문자·숫자·특수문자를 각 1개 이상 포함해야 합니다. (예: Emp12345!)');
      setPwSuccess(false);
      return;
    }
    try {
      await changePassword({ currentPassword: pwCurrent, newPassword: pwNext });
      setPwMsg('비밀번호가 변경되었습니다.');
      setPwSuccess(true);
      setPwCurrent(''); setPwNext(''); setPwConfirm('');
    } catch {
      setPwMsg('변경 실패. 현재 비밀번호를 확인해 주세요.');
      setPwSuccess(false);
    }
  };

  const handleDownload = async (certId: number) => {
    setDownloading(certId);
    await downloadCertificate(certId);
    setDownloading(null);
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-xs text-gray-400">불러오는 중...</div>;

  const inProgressCount = history.filter((h) => h.status === 'IN_PROGRESS').length;
  const doneCount = mypage?.completedCoursesCount ?? 0;
  const rate = Math.round(mypage?.overallCompletionRate ?? 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
      <div className="flex flex-col gap-5">

        {/* 프로필 카드 */}
        {mypage && (
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm overflow-hidden">
            {/* 상단 배너 */}
            <div className="h-20 bg-gradient-to-r from-[#185FA5] to-[#4A90D9]" />
            <div className="px-6 pb-6">
              {/* 아바타 */}
              <div className="flex items-end justify-between -mt-8 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center text-2xl font-black text-[#185FA5]">
                  {mypage.name?.[0] ?? '?'}
                </div>
                <div className="flex gap-2 pb-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold border border-blue-100">
                    {mypage.empType === '현장직' ? '현장직' : '사무직'}
                  </span>
                </div>
              </div>

              {/* 이름 + 정보 */}
              <div className="mb-4">
                <h3 className="text-lg font-black text-gray-800">{mypage.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{mypage.departmentName} · {mypage.position}</p>
                <p className="text-xs text-gray-400">{mypage.employeeNo}</p>
              </div>

              {/* 통계 3칸 */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '수강 중', value: inProgressCount, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: '이수 완료', value: doneCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: '전체 이수율', value: `${rate}%`, color: 'text-[#185FA5]', bg: 'bg-[#E6F1FB]' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                    <div className={`text-xl font-black ${color}`}>{value}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* 이수율 바 */}
              <div className="mt-4">
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>전체 이수율</span><span className="font-semibold text-[#185FA5]">{rate}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#185FA5] to-[#4A90D9] rounded-full transition-all duration-500"
                    style={{ width: `${rate}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 이수증 / 수강 이력 탭 */}
        <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5 flex flex-col gap-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {([['certs', `🏅 이수증 (${certs.length})`], ['history', `📚 수강 이력 (${history.length})`]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setActiveSection(k)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeSection === k ? 'bg-white shadow-sm text-[#185FA5]' : 'text-gray-400 hover:text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>

          {activeSection === 'certs' ? (
            <div className="flex flex-col gap-3">
              {certs.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="text-3xl mb-2">🏅</div>
                  <p className="text-xs text-gray-400">아직 이수한 강좌가 없습니다.</p>
                  <Link href="/courses" className="inline-block mt-2 text-xs text-[#185FA5] font-semibold hover:underline">수강신청 하러 가기 →</Link>
                </div>
              ) : (
                certs.map((cert) => (
                  <div key={cert.certificateId}
                    className="flex items-center gap-4 p-4 rounded-xl border border-black/[0.06] bg-gradient-to-r from-amber-50/60 to-white hover:shadow-sm transition-shadow">
                    {/* 아이콘 */}
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-lg shrink-0">
                      🏅
                    </div>
                    {/* 텍스트 */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-800 truncate">{cert.courseTitle}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(cert.issuedAt).toLocaleDateString('ko-KR')} 발급
                      </div>
                    </div>
                    {/* 다운로드 버튼 */}
                    <button
                      onClick={() => handleDownload(cert.certificateId)}
                      disabled={downloading === cert.certificateId}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[#185FA5] bg-white border border-[#185FA5]/30 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors">
                      {downloading === cert.certificateId ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          PDF
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {history.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="text-3xl mb-2">📚</div>
                  <p className="text-xs text-gray-400">수강 이력이 없습니다.</p>
                  <Link href="/courses" className="inline-block mt-2 text-xs text-[#185FA5] font-semibold hover:underline">수강신청 하러 가기 →</Link>
                </div>
              ) : (
                history.map((h) => {
                  const style = STATUS_STYLE[h.status] ?? { label: h.status, color: 'text-gray-400', bar: 'bg-gray-300' };
                  return (
                    <div key={h.enrollmentId} className="border border-black/[0.06] rounded-xl p-4 flex flex-col gap-2 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-sm text-gray-800 leading-snug">{h.courseTitle}</div>
                        <span className={`text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full ${
                          h.status === 'DONE' ? 'bg-emerald-50 text-emerald-600' :
                          h.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600' : 'bg-yellow-50 text-yellow-600'
                        }`}>{style.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${h.progress}%` }} />
                        </div>
                        <span className="text-[11px] text-gray-500 w-7 text-right font-semibold">{h.progress}%</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-400">
                        <span>{h.roundNo}차</span>
                        <span>신청: {h.enrolledAt?.slice(0,10)}</span>
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

      {/* 우측 패널 */}
      <div className="flex flex-col gap-4">
        {/* 알림함 */}
        <Link href="/notifications"
          className="flex items-center justify-between bg-white border border-black/[0.06] rounded-2xl shadow-sm px-4 py-3 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <span className="text-sm font-bold text-gray-700">알림함</span>
          </div>
          <span className="text-xs text-[#185FA5] font-semibold">전체보기 →</span>
        </Link>

        {/* 비밀번호 변경 */}
        <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🔒</span>
            <h4 className="font-bold text-sm text-gray-800">비밀번호 변경</h4>
          </div>
          <form onSubmit={handlePwChange} className="flex flex-col gap-2.5">
            {[
              { placeholder: '현재 비밀번호', value: pwCurrent, onChange: (v: string) => { setPwCurrent(v); setPwMsg(''); } },
              { placeholder: '새 비밀번호 (8자 이상)', value: pwNext, onChange: (v: string) => { setPwNext(v); setPwMsg(''); } },
              { placeholder: '새 비밀번호 확인', value: pwConfirm, onChange: (v: string) => { setPwConfirm(v); setPwMsg(''); } },
            ].map(({ placeholder, value, onChange }) => (
              <input key={placeholder} type="password" placeholder={placeholder} required
                className="w-full px-3 py-2 text-xs border border-black/10 rounded-lg outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5]/20 transition-all"
                value={value} onChange={(e) => onChange(e.target.value)} />
            ))}
            {pwMsg && (
              <div className={`text-xs px-3 py-2 rounded-lg border ${pwSuccess ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-red-500 bg-red-50 border-red-100'}`}>
                {pwMsg}
              </div>
            )}
            <button type="submit"
              className="w-full py-2.5 bg-[#185FA5] text-white text-xs font-bold rounded-lg hover:bg-[#144f8b] transition-colors mt-1">
              변경 적용하기
            </button>
          </form>
        </div>

        {/* 내 정보 요약 */}
        {mypage && (
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5">
            <h4 className="font-bold text-sm text-gray-700 mb-3">내 정보</h4>
            <div className="flex flex-col gap-2 text-xs">
              {[
                { label: '이메일', value: mypage.email },
                { label: '입사일', value: mypage.hireDate },
                { label: '직군', value: mypage.empType },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-gray-700 font-medium">{value || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
