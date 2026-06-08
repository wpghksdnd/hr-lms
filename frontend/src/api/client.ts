import axios from 'axios';

const client = axios.create({
  baseURL: '',   // Next.js rewrites가 /api/* → 백엔드로 프록시
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // localStorage 우선, 비밀번호 강제변경 진행 중에는 sessionStorage fallback 사용
    const token = localStorage.getItem('token') ?? sessionStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // 이미 로그인 페이지면 리다이렉트 하지 않음 (무한루프 방지)
      if (!window.location.pathname.startsWith('/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    // 백엔드가 { error: "..." } 형식으로 내려올 때 .message 로 통일
    if (error.response?.data) {
      const d = error.response.data;
      if (!d.message && d.error) d.message = d.error;
    }
    return Promise.reject(error);
  }
);

export default client;
