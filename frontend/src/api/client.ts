import axios from 'axios';

const client = axios.create({
  baseURL: '',   // Next.js rewrites가 /api/* → 백엔드로 프록시
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,  // httpOnly 쿠키 자동 전송
  timeout: 30000,
});

let isRefreshing = false;
let pendingQueue: Array<{ resolve: () => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown) {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  pendingQueue = [];
}

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/login') &&
      !originalRequest._retry &&
      originalRequest.url !== '/api/auth/refresh'
    ) {
      if (isRefreshing) {
        // 이미 갱신 중이면 큐에 대기
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: () => resolve(client(originalRequest)),
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        processQueue(null);
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
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
