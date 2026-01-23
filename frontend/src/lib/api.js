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
    return response.data;
  },
};

// Code Generation API (SSE)
export const generateCode = (projectId, prompt, onEvent) => {
  const token = localStorage.getItem('auth_token');
  
  return new Promise((resolve, reject) => {
    fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ project_id: projectId, prompt }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Generation failed');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        const processStream = async () => {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              resolve();
              break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  onEvent(data);
                } catch (e) {
                  console.error('Parse error:', e);
                }
              }
            }
          }
        };
        
        processStream();
      })
      .catch(reject);
  });
};

// Preview API
export const getPreview = async (projectId) => {
  const response = await axios.get(`${API_BASE}/preview/${projectId}`);
  return response.data;
};

export default api;
