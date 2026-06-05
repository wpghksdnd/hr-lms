import client from './client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export async function sendChat(message: string): Promise<string> {
  const res = await client.post<{ reply: string; userId: string }>('/api/user/chat', { message });
  return res.data.reply;
}
