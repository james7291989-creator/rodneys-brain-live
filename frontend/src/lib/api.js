import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: async (data) => (await api.post('/auth/register', data)).data,
  login: async (data) => (await api.post('/auth/login', data)).data,
  getMe: async () => (await api.get('/auth/me')).data,
};

export const projectsApi = {
  create: async (data) => (await api.post('/projects', data)).data,
  list: async () => (await api.get('/projects')).data,
  get: async (id) => (await api.get(`/projects/${id}`)).data,
  update: async (id, data) => (await api.patch(`/projects/${id}`, data)).data,
  delete: async (id) => (await api.delete(`/projects/${id}`)).data,
};

export const generateCode = async (projectId, prompt, onEvent) => {
  try {
    onEvent({ type: 'status', content: 'Waking up Rodney\'s Brain...' });
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
    });
    if (!response.ok) throw new Error('Brain Connection Failed');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullCode = '';
    onEvent({ type: 'status', content: 'Writing masterpiece...' });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('0:')) {
          try {
            const text = JSON.parse(line.slice(2));
            fullCode += text;
            const clean = fullCode.replace(/```(html|javascript|css|tsx|jsx)?\n/g, '').replace(/```/g, '');
            onEvent({ type: 'file', filename: 'index.html', content: clean });
          } catch (e) {}
        }
      }
    }
    onEvent({ type: 'complete', content: 'Complete!' });
  } catch (error) {
    onEvent({ type: 'error', content: `System Error: ${error.message}` });
  }
};

export default api;

