'use client';
import { useEffect, useRef, useState } from 'react';
import { sendChat } from '@/api/chat';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

const SUGGESTIONS = [
  '수강 중인 강좌를 알려줘',
  '직장 내 성희롱 예방 교육이 필요한 이유는?',
  '이수증은 어떻게 받을 수 있어?',
  '강의 진도율을 올리려면 어떻게 해야 해?',
];

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '안녕하세요! 저는 LMS AI 학습 도우미입니다. 강의 내용, 교육 정책, 수강 방법 등 궁금한 것을 무엇이든 질문해 주세요. 😊',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    setServerDown(false);

    try {
      const reply = await sendChat(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const isServerErr = !errMsg || errMsg.includes('연결') || errMsg.includes('서버');
      if (isServerErr) setServerDown(true);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: isServerErr
            ? '⚠️ AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
            : errMsg ?? '오류가 발생했습니다.',
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-[720px] mx-auto flex flex-col h-[calc(100vh-160px)] min-h-[500px]">
      {/* 헤더 */}
      <div className="bg-white border border-black/[0.06] rounded-t-xl px-5 py-4 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-full bg-[#185FA5] flex items-center justify-center text-lg">🤖</div>
        <div>
          <div className="text-sm font-bold text-[#111]">AI 학습 도우미</div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${serverDown ? 'bg-red-400' : 'bg-emerald-400'}`} />
            <span className="text-[10px] text-gray-400">{serverDown ? 'AI 서버 연결 끊김' : '온라인'}</span>
          </div>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto bg-[#f8f9fb] border-x border-black/[0.06] px-4 py-4 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* 아바타 */}
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-[#185FA5] flex items-center justify-center text-xs shrink-0 mb-0.5">🤖</div>
            )}
            {/* 말풍선 */}
            <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-[#185FA5] text-white rounded-br-sm'
                : msg.error
                  ? 'bg-red-50 text-red-600 border border-red-100 rounded-bl-sm'
                  : 'bg-white text-[#222] border border-black/[0.06] shadow-sm rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* 로딩 */}
        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full bg-[#185FA5] flex items-center justify-center text-xs shrink-0">🤖</div>
            <div className="bg-white border border-black/[0.06] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5 items-center">
                {[0, 1, 2].map((n) => (
                  <span key={n} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${n * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 추천 질문 (메시지가 1개일 때만) */}
      {messages.length === 1 && (
        <div className="bg-[#f8f9fb] border-x border-black/[0.06] px-4 pb-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => handleSend(s)}
              className="text-[11px] px-2.5 py-1.5 border border-[#185FA5]/30 text-[#185FA5] rounded-full hover:bg-[#E6F1FB] transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 입력창 */}
      <div className="bg-white border border-black/[0.06] rounded-b-xl px-4 py-3 flex gap-2 items-end shadow-sm">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="질문을 입력하세요... (Enter로 전송, Shift+Enter 줄바꿈)"
          rows={1}
          className="flex-1 resize-none text-sm outline-none bg-transparent max-h-28 min-h-[36px] leading-relaxed py-1"
          style={{ height: 'auto' }}
          onInput={(e) => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = 'auto';
            t.style.height = Math.min(t.scrollHeight, 112) + 'px';
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="shrink-0 w-9 h-9 bg-[#185FA5] hover:bg-[#144f8b] disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      {/* Flask 서버 안내 */}
      {serverDown && (
        <div className="mt-2 text-[11px] text-center text-gray-400">
          AI 서버가 꺼져 있습니다. 관리자에게 AI 서버 상태를 확인해 주세요.
        </div>
      )}
    </div>
  );
}
