import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: async (data) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },
  login: async (data) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Projects API
export const projectsApi = {
  create: async (data) => {
    const response = await api.post('/projects', data);
    return response.data;
  },
  list: async () => {
    const response = await api.get('/projects');
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`/projects/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/projects/${id}`);
    // Code Generation API (Hijacked to Gemini Engine)
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
      if (done) {
        onEvent({ type: 'complete', content: 'Code generation complete!' });
        const finalDisplay = fullCode.replace(/```(html|javascript|css|tsx|jsx)?\n/g, '').replace(/```/g, '');
        onEvent({ type: 'preview', content: finalDisplay });
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('0:')) {
          try {
            const text = JSON.parse(line.slice(2));
            fullCode += text;
            const displayCode = fullCode.replace(/```(html|javascript|css|tsx|jsx)?\n/g, '').replace(/```/g, '');
            onEvent({ type: 'file', filename: 'index.html', content: displayCode });
          } catch (e) {}
        }
      }
    }
  } catch (error) {
    onEvent({ type: 'error', content: `System Error: ${error.message}` });
  }
};
export const getPreview = async (projectId) => {
  const response = await axios.get(`${API_BASE}/preview/${projectId}`);
  return response.data;
};

export default api;
