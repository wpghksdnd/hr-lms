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

  // 비밀번호 강제 변경 상태
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
      // 토큰은 httpOnly 쿠키로 자동 처리 — localStorage에는 저장하지 않음
      if (!data.passwordChanged) {
        // 비밀번호 변경 전: 다른 탭 접근을 막기 위해 user 정보를 sessionStorage에만 보관
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
      // 변경 완료 후 sessionStorage → localStorage로 이동
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

  // 비밀번호 강제 변경 화면
  if (needsPwChange) {
    return (
      <div className="min-h-screen bg-[#f5f5f3] flex items-center justify-center p-4">
        <div className="w-full max-w-[400px] bg-white border border-black/[0.06] rounded-2xl p-8 shadow-sm">
          <h1 className="text-xl font-black text-[#185FA5] mb-1">비밀번호 변경 필요</h1>
          <p className="text-xs text-gray-400 mb-6">첫 로그인입니다. 초기 비밀번호를 변경해 주세요.</p>
          <form onSubmit={handlePwChangeSubmit} className="flex flex-col gap-3.5">
            <input type="password" required placeholder="현재 비밀번호 (초기: 사원번호)"
              className="w-full p-3 text-xs border border-black/10 rounded-xl outline-none focus:border-[#185FA5]"
              value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
            <input type="password" required placeholder="새 비밀번호 (대·소문자+숫자+특수문자, 8자 이상)"
              className="w-full p-3 text-xs border border-black/10 rounded-xl outline-none focus:border-[#185FA5]"
              value={pwNext} onChange={(e) => setPwNext(e.target.value)} />
            <input type="password" required placeholder="새 비밀번호 확인"
              className="w-full p-3 text-xs border border-black/10 rounded-xl outline-none focus:border-[#185FA5]"
              value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
            {pwError && <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{pwError}</div>}
            <button type="submit" disabled={pwLoading}
              className="w-full py-3.5 bg-[#185FA5] hover:bg-[#144f8b] disabled:bg-gray-300 text-white font-bold rounded-xl text-xs mt-1 transition-colors">
              {pwLoading ? '변경 중...' : '변경 후 시작하기'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-white border border-black/[0.06] rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-[#185FA5] tracking-tight mb-1">LMS</h1>
          <p className="text-xs text-gray-400">사내 교육 플랫폼</p>
        </div>

        <div className="flex gap-1 mb-5 bg-gray-50 p-1 rounded-xl">
          {(['login', 'info'] as const).map((mode) => (
            <button key={mode} onClick={() => { setAuthMode(mode); setLoginError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${authMode === mode ? 'bg-white shadow-sm text-[#185FA5]' : 'text-gray-400'}`}>
              {mode === 'login' ? '로그인' : '계정 안내'}
            </button>
          ))}
        </div>

        {authMode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-600">사원번호</label>
              <input type="text" required placeholder="사원번호를 입력하세요"
                className="w-full p-3 text-xs border border-black/10 rounded-xl outline-none focus:border-[#185FA5] bg-gray-50/50"
                value={empNo} onChange={(e) => { setEmpNo(e.target.value); setLoginError(''); }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-600">비밀번호</label>
              <input type="password" required placeholder="비밀번호를 입력하세요"
                className="w-full p-3 text-xs border border-black/10 rounded-xl outline-none focus:border-[#185FA5] bg-gray-50/50"
                value={password} onChange={(e) => { setPassword(e.target.value); setLoginError(''); }} />
            </div>
            {loginError && (
              <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{loginError}</div>
            )}
            <button type="submit" disabled={isLoading}
              className="w-full py-3.5 bg-[#185FA5] hover:bg-[#144f8b] disabled:bg-gray-300 text-white font-bold rounded-xl text-xs mt-2 transition-colors">
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
            <div className="text-center text-xs text-gray-400 mt-2">초기 비밀번호는 사원번호와 동일합니다.</div>
          </form>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col gap-2">
              <p className="text-xs font-bold text-[#185FA5]">계정 발급 안내</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                계정은 인사팀(관리자)을 통해 발급됩니다.<br />
                사원번호와 초기 비밀번호를 받으셨다면 로그인 후 비밀번호를 변경해 주세요.
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex flex-col gap-1.5">
              <p className="text-xs font-bold text-gray-600">로그인 방법</p>
              <p className="text-xs text-gray-500 leading-relaxed">① 인사팀에서 사원번호 수령</p>
              <p className="text-xs text-gray-500 leading-relaxed">② 초기 비밀번호 = 사원번호</p>
              <p className="text-xs text-gray-500 leading-relaxed">③ 첫 로그인 시 비밀번호 강제 변경</p>
            </div>
            <p className="text-[11px] text-center text-gray-400">문의: 인사팀 담당자에게 연락해 주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
