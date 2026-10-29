import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  withCredentials: true, // Send cookies with requests
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ga_token') || Cookies.get('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem('ga_token');
      Cookies.remove('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email, password) => api.post('/api/v1/auth/login', { email, password }),
  logout: () => api.post('/api/v1/auth/logout'),
};

export const casesApi = {
  scan: () => api.post('/api/v1/cases/scan'),
  list: (params) => api.get('/api/v1/cases', { params }),
  get: (id) => api.get(`/api/v1/cases/${id}`),
  update: (id, data) => api.put(`/api/v1/cases/${id}`, data),
  delete: (id) => api.delete(`/api/v1/cases/${id}`),
  generateVerdict: (id) => api.post(`/api/v1/cases/${id}/verdict`),
  getVerdict: (id) => api.get(`/api/v1/cases/${id}/verdict`),
  submitFeedback: (id, status, feedbackText) => api.post(`/api/v1/cases/${id}/feedback`, { status, feedbackText }),
  history: (id) => api.get(`/api/v1/cases/${id}/history`),
  playbook: (id) => api.post(`/api/v1/cases/${id}/playbook`),
  uploadEvidence: (id, payload) => api.post(`/api/v1/cases/${id}/evidence`, payload),
  listEvidence: (id) => api.get(`/api/v1/cases/${id}/evidence`),
  negotiate: (id, tone) => api.post(`/api/v1/cases/${id}/negotiate`, { tone }),
  accuracy: () => api.get('/api/v1/cases/accuracy'),
};

export const analyticsApi = {
  benford: (vendorId) => api.get('/api/v1/analytics/benford', { params: vendorId ? { vendorId } : {} }),
  duplicates: () => api.get('/api/v1/analytics/duplicates'),
  thresholds: () => api.get('/api/v1/analytics/thresholds'),
  riskScores: () => api.get('/api/v1/analytics/risk-scores'),
  saveRun: (data) => api.post('/api/v1/analytics/save', data),
  runs: () => api.get('/api/v1/analytics/runs'),
  msmeDelays: () => api.get('/api/v1/analytics/msme-delays'),
  drift: () => api.get('/api/v1/analytics/drift'),
  forecast: () => api.get('/api/v1/analytics/forecast'),
  peerBenchmark: () => api.get('/api/v1/analytics/peer-benchmark'),
  shadowProcurement: () => api.get('/api/v1/analytics/shadow-procurement'),
};

export const networkApi = {
  get: () => api.get('/api/v1/network'),
};

export const notificationsApi = {
  list: () => api.get('/api/v1/notifications'),
  markRead: (id) => api.post(`/api/v1/notifications/${id}/read`),
  markAllRead: () => api.post('/api/v1/notifications/read-all'),
};

export const copilotApi = {
  ask: (question) => api.post('/api/v1/copilot/ask', { question }),
  ingestPolicy: (title, text) => api.post('/api/v1/copilot/policy', { title, text }),
  listPolicies: () => api.get('/api/v1/copilot/policy'),
};

export const transactionsApi = {
  getAll: (params) => api.get('/api/v1/transactions', { params }),
  create: (data) => api.post('/api/v1/transactions', data),
  bulkCreate: (data) => api.post('/api/v1/transactions/bulk', data),
};

export const vendorsApi = {
  getAll: () => api.get('/api/v1/vendors'),
  verifyGst: (id) => api.get(`/api/v1/vendors/${id}/gst-verify`),
};

export const reportsApi = {
  generate: () => api.post('/api/v1/reports/generate'),
  list: () => api.get('/api/v1/reports'),
  get: (id) => api.get(`/api/v1/reports/${id}`),
};

export default api;
