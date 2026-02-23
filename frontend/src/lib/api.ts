import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('euexia_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('[API] No auth token found in localStorage');
    }
  }
  return config;
});

// Handle 401 errors - token expired or invalid
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('[API] 401 Unauthorized - Token may be expired or invalid');
      if (typeof window !== 'undefined') {
        // Clear invalid token
        localStorage.removeItem('euexia_token');
        // Redirect to login if not already there
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  guest: () => api.post('/auth/guest'),
  getMe: () => api.get('/auth/me'),
};

// Upload / Consultations
export const uploadApi = {
  createConsultation: (data: { title: string; uploads: any[] }) =>
    api.post('/upload/consultation', data),
  getConsultations: () => api.get('/upload/consultations'),
  deleteConsultation: (consultationId: string) =>
    api.delete(`/upload/consultation/${consultationId}`),
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Checklist
export const checklistApi = {
  getAll: () => api.get('/checklist'),
  getByConsultation: (consultationId: string) =>
    api.get(`/checklist/consultation/${consultationId}`),
  complete: (itemId: string) => api.post(`/checklist/${itemId}/complete`),
  uncomplete: (itemId: string) => api.post(`/checklist/${itemId}/uncomplete`),
};

// Game
export const gameApi = {
  getProgress: () => api.get('/game/progress'),
  getLeaderboard: (limit?: number) =>
    api.get('/game/leaderboard', { params: { limit } }),
  getMapSpec: () => api.get('/game/map-spec'),
  getCurrentMap: () => api.get('/game/current-map'),
  getMap: (consultationId: string, mapIndex?: number) =>
    api.get('/game/map', { params: { consultationId, mapIndex } }),
  getConsultationsWithMaps: () => api.get('/game/consultations'),
};

// Doctor chat
export const chatApi = {
  getHistory: (consultationId?: string, limit: number = 40) =>
    api.get('/chat', { params: { consultationId, limit } }),
  sendMessage: (message: string, consultationId?: string) =>
    api.post('/chat/message', { message, consultationId }),
};

export default api;

