'use client';
import { useEffect, useState } from 'react';
import { broadcastNotification, getAdminNotifications, getEmployees } from '@/api/adminApi';
import type { NotificationItem } from '@/api/types';

const TYPE_LABEL: Record<string, string> = {
  ENROLLMENT_APPROVED:  '✅ 수강 승인',
  ENROLLMENT_REJECTED:  '❌ 수강 반려',
  CERTIFICATE_ISSUED:   '🏅 이수증 발급',
  COURSE_DEADLINE:      '⏰ 수강 마감',
  COURSE_STARTED:       '📚 강좌 시작',
  SYSTEM:               '🔔 시스템',
};

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 브로드캐스트 폼
  const [message, setMessage] = useState('');
  const [targetAll, setTargetAll] = useState(true);
  const [employees, setEmployees] = useState<{ userId: number; name: string; employeeNo: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

  useEffect(() => {
    getAdminNotifications().then(setNotifications).catch(() => {}).finally(() => setLoading(false));
    getEmployees().then((list) => setEmployees(list.map((e) => ({ userId: e.userId, name: e.name, employeeNo: e.employeeNo })))).catch(() => {});
  }, []);

  const toggleId = (id: number) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleBroadcast = async () => {
    if (!message.trim()) { setSendMsg('메시지를 입력해 주세요.'); return; }
    if (!targetAll && selectedIds.length === 0) { setSendMsg('직원을 1명 이상 선택해 주세요.'); return; }
    setSending(true); setSendMsg('');
    try {
      const res = await broadcastNotification(message.trim(), targetAll ? undefined : selectedIds);
      setSendMsg(`✅ ${res.sentCount}명에게 알림을 발송했습니다.`);
      setMessage(''); setSelectedIds([]);
      getAdminNotifications().then(setNotifications).catch(() => {});
    } catch {
      setSendMsg('❌ 발송에 실패했습니다.');
    } finally { setSending(false); }
  };

  // 타입별 색상
  const typeCount = notifications.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-black text-[#111]">알림 관리</h1>
        <p className="text-xs text-gray-400 mt-0.5">전체 알림 이력 조회 및 공지 알림 발송</p>
      </div>

      {/* 타입별 요약 */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(typeCount).map(([type, count]) => (
          <div key={type} className="bg-white border border-black/[0.06] rounded-xl px-3 py-2 shadow-sm text-center">
            <div className="text-xs font-black text-gray-700">{count}</div>
            <div className="text-[10px] text-gray-400">{TYPE_LABEL[type] ?? type}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        {/* 알림 이력 */}
        <div className="bg-white border border-black/[0.06] rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-black/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700">전체 알림 이력</h3>
            <span className="text-xs text-gray-400">총 {notifications.length}건</span>
          </div>
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400">불러오는 중...</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">알림 이력이 없습니다.</div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto divide-y divide-black/[0.04]">
              {notifications.map((n) => (
                <div key={n.notificationId} className={`flex items-start gap-3 px-5 py-3 ${n.read ? '' : 'bg-blue-50/40'}`}>
                  <span className="text-base shrink-0 mt-0.5">{TYPE_LABEL[n.type]?.split(' ')[0] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug ${n.read ? 'text-gray-500' : 'text-gray-800 font-semibold'}`}>
                      {n.message}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {TYPE_LABEL[n.type]?.split(' ').slice(1).join(' ') ?? n.type}
                      {' · '}
                      {new Date(n.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.read && <span className="w-1.5 h-1.5 bg-[#185FA5] rounded-full shrink-0 mt-2" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 브로드캐스트 */}
        <div className="bg-white border border-black/[0.06] rounded-xl shadow-sm p-5 flex flex-col gap-4 h-fit">
          <h3 className="text-sm font-bold text-gray-700">📣 공지 알림 발송</h3>

          <textarea value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="직원들에게 보낼 알림 메시지를 입력하세요."
            rows={4}
            className="w-full text-xs border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#185FA5] resize-none" />

          {/* 대상 선택 */}
          <div>
            <div className="flex gap-3 mb-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" checked={targetAll} onChange={() => setTargetAll(true)} className="accent-[#185FA5]" />
                전체 직원
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" checked={!targetAll} onChange={() => setTargetAll(false)} className="accent-[#185FA5]" />
                특정 직원 선택
              </label>
            </div>

            {!targetAll && (
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {employees.map((emp) => (
                  <label key={emp.userId} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedIds.includes(emp.userId)} onChange={() => toggleId(emp.userId)}
                      className="accent-[#185FA5]" />
                    <span className="text-xs text-gray-700">{emp.name}</span>
                    <span className="text-[10px] text-gray-400">({emp.employeeNo})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {sendMsg && (
            <div className={`text-xs px-3 py-2 rounded-lg ${sendMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
              {sendMsg}
            </div>
          )}

          <button onClick={handleBroadcast} disabled={sending}
            className="w-full py-2.5 text-xs font-bold bg-[#185FA5] text-white rounded-xl hover:bg-[#144f8b] disabled:bg-gray-300 transition-colors">
            {sending ? '발송 중...' : '알림 발송'}
          </button>
        </div>
      </div>
    </div>
  );
}
