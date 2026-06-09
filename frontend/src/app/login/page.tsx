'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, changePassword } from '@/api/auth';

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'login' | 'info'>('login');
  const [empNo, setEmpNo]         = useState('');
  const [password, setPassword]   = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading]   = useState(false);

  const [needsPwChange, setNeedsPwChange] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);
    try {
      const data = await login({ employeeNo: empNo, password });
      if (!data.passwordChanged) {
        sessionStorage.setItem('user', JSON.stringify(data));
        setNeedsPwChange(true);
      } else {
        localStorage.setItem('user', JSON.stringify(data));
      }
      if (data.passwordChanged) {
        router.replace(data.role === 'ROLE_ADMIN' ? '/admin/dashboard' : '/dashboard');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setLoginError(msg ?? '로그인에 실패했습니다. 사원번호 또는 비밀번호를 확인해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePwChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwNext !== pwConfirm) { setPwError('새 비밀번호가 일치하지 않습니다.'); return; }
    if (pwNext.length < 8) { setPwError('비밀번호는 8자 이상이어야 합니다.'); return; }
    if (!/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':,.<>?])/.test(pwNext)) {
      setPwError('대문자·소문자·숫자·특수문자를 각 1개 이상 포함해야 합니다. (예: Emp12345!)');
      return;
    }
    setPwLoading(true);
    try {
      await changePassword({ currentPassword: pwCurrent, newPassword: pwNext });
      const stored = sessionStorage.getItem('user') ?? localStorage.getItem('user');
      let role = 'ROLE_USER';
      if (stored) {
        const parsed = JSON.parse(stored);
        role = parsed.role ?? 'ROLE_USER';
        localStorage.setItem('user', JSON.stringify({ ...parsed, passwordChanged: true }));
        sessionStorage.removeItem('user');
      }
      router.replace(role === 'ROLE_ADMIN' ? '/admin/dashboard' : '/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPwError(msg ?? '변경 실패. 현재 비밀번호를 확인해 주세요.');
    } finally {
      setPwLoading(false);
    }
  };

  /* 비밀번호 강제 변경 — 전체 화면 */
  if (needsPwChange) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h1 className="text-lg font-black text-gray-900">비밀번호 변경 필요</h1>
            <p className="text-xs text-gray-400 mt-1">첫 로그인입니다. 초기 비밀번호를 변경해 주세요.</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <form onSubmit={handlePwChangeSubmit} className="flex flex-col gap-3">
              <input type="password" required placeholder="현재 비밀번호 (초기: 사원번호)"
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
              <input type="password" required placeholder="새 비밀번호 (대·소문자+숫자+특수문자, 8자 이상)"
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                value={pwNext} onChange={(e) => setPwNext(e.target.value)} />
              <input type="password" required placeholder="새 비밀번호 확인"
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
              {pwError && (
                <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">{pwError}</div>
              )}
              <button type="submit" disabled={pwLoading}
                className="w-full py-3 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-gray-300 text-white font-bold rounded-xl text-sm mt-1 transition-colors">
                {pwLoading ? '변경 중...' : '변경 후 시작하기'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* 메인 로그인 — 스플릿 레이아웃 */
  return (
    <div className="min-h-screen flex">

      {/* ── 왼쪽 패널 (데스크톱 전용) ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-12"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 55%, #1d4ed8 100%)' }}>

        {/* 도트 패턴 */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* 장식 원 */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* 로고 */}
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/30 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <span className="text-2xl font-black text-white tracking-tight">INSIGHT</span>
          </div>
          <p className="text-blue-300 text-sm mt-1.5 ml-0.5">사내 교육 통합 플랫폼</p>
        </div>

        {/* 메인 카피 */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-12">
          <h2 className="text-[2.4rem] font-black text-white leading-tight tracking-tight">
            체계적인<br />
            임직원 교육을<br />
            <span className="text-blue-300">한 곳에서.</span>
          </h2>
          <p className="text-blue-200/80 mt-5 text-sm leading-relaxed max-w-xs">
            법정의무교육부터 직무역량 강화까지,<br />
            모든 학습 여정을 INSIGHT와 함께하세요.
          </p>

          {/* 기능 리스트 */}
          <ul className="mt-9 flex flex-col gap-3.5">
            {[
              { icon: '📊', text: '실시간 학습 현황 대시보드' },
              { icon: '🤖', text: 'AI 기반 학습 도우미' },
              { icon: '🏅', text: '이수증 자동 발급 시스템' },
              { icon: '🔔', text: '수강 승인 · 마감 알림' },
            ].map(({ icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-blue-100/90">
                <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-base shrink-0">{icon}</span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* 푸터 */}
        <p className="relative z-10 text-blue-400/40 text-[11px] font-medium">
          © 2026 INSIGHT. All rights reserved.
        </p>
      </div>

      {/* ── 오른쪽 패널 — 폼 ── */}
      <div className="flex-1 flex items-center justify-center bg-[#F1F5F9] p-6 sm:p-10">
        <div className="w-full max-w-[380px]">

          {/* 모바일 전용 로고 */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-2xl font-black text-[#1d4ed8]">INSIGHT</h1>
            <p className="text-xs text-gray-400 mt-0.5">사내 교육 통합 플랫폼</p>
          </div>

          {/* 카드 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7 sm:p-8">

            {/* 탭 */}
            <div className="flex gap-1 mb-6 bg-gray-50 border border-gray-100 p-1 rounded-xl">
              {(['login', 'info'] as const).map((mode) => (
                <button key={mode}
                  onClick={() => { setAuthMode(mode); setLoginError(''); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    authMode === mode
                      ? 'bg-white shadow-sm text-[#1d4ed8]'
                      : 'text-gray-400 hover:text-gray-500'
                  }`}>
                  {mode === 'login' ? '로그인' : '계정 안내'}
                </button>
              ))}
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 tracking-wide uppercase">사원번호</label>
                  <input type="text" required placeholder="사원번호를 입력하세요"
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-gray-50 transition-all"
                    value={empNo} onChange={(e) => { setEmpNo(e.target.value); setLoginError(''); }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 tracking-wide uppercase">비밀번호</label>
                  <input type="password" required placeholder="비밀번호를 입력하세요"
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 bg-gray-50 transition-all"
                    value={password} onChange={(e) => { setPassword(e.target.value); setLoginError(''); }} />
                </div>

                {loginError && (
                  <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {loginError}
                  </div>
                )}

                <button type="submit" disabled={isLoading}
                  className="w-full py-3.5 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:bg-gray-300 text-white font-bold rounded-xl text-sm mt-1 transition-all shadow-sm hover:shadow-blue-500/20 hover:shadow-md active:scale-[0.98]">
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      로그인 중...
                    </span>
                  ) : '로그인'}
                </button>

                <p className="text-center text-[11px] text-gray-400 mt-1">
                  초기 비밀번호는 사원번호와 동일합니다.
                </p>
              </form>
            ) : (
              <div className="flex flex-col gap-3.5">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-700 mb-1.5">계정 발급 안내</p>
                  <p className="text-xs text-blue-600/80 leading-relaxed">
                    계정은 인사팀(관리자)을 통해 발급됩니다.<br />
                    사원번호와 초기 비밀번호를 받으셨다면<br />
                    로그인 후 비밀번호를 변경해 주세요.
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex flex-col gap-2">
                  <p className="text-xs font-bold text-gray-600">로그인 방법</p>
                  {['① 인사팀에서 사원번호 수령', '② 초기 비밀번호 = 사원번호', '③ 첫 로그인 시 비밀번호 강제 변경'].map((s) => (
                    <p key={s} className="text-xs text-gray-500 leading-relaxed">{s}</p>
                  ))}
                </div>
                <p className="text-[11px] text-center text-gray-400">문의: 인사팀 담당자에게 연락해 주세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
