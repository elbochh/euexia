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
    }
  }
  return config;
});

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Upload / Consultations
export const uploadApi = {
  createConsultation: (data: { title: string; uploads: any[] }) =>
    api.post('/upload/consultation', data),
  getConsultations: () => api.get('/upload/consultations'),
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

export default api;

