import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ga_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem('ga_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
};

export const casesApi = {
  scan: () => api.post('/api/cases/scan'),
  list: (params) => api.get('/api/cases', { params }),
  get: (id) => api.get(`/api/cases/${id}`),
  generateVerdict: (id) => api.post(`/api/cases/${id}/verdict`),
  getVerdict: (id) => api.get(`/api/cases/${id}/verdict`),
  submitFeedback: (id, status, feedbackText) => api.post(`/api/cases/${id}/feedback`, { status, feedbackText }),
};

export const transactionsApi = {
  getAll: () => api.get('/api/transactions'),
  create: (data) => api.post('/api/transactions', data),
  bulkCreate: (data) => api.post('/api/transactions/bulk', data),
};

export const vendorsApi = {
  getAll: () => api.get('/api/vendors'),
  verifyGst: (id) => api.get(`/api/vendors/${id}/gst-verify`),
};

export const reportsApi = {
  generate: () => api.post('/api/reports/generate'),
  list: () => api.get('/api/reports'),
  get: (id) => api.get(`/api/reports/${id}`),
};

export default api;
