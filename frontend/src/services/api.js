const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const AUTH_TOKEN_KEY = 'healthbridge_auth_token';

function getStoredToken() {
  if (typeof window === 'undefined') {
    return '';
  }

  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function setStoredToken(token) {
  if (typeof window === 'undefined') {
    return;
  }

  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }

  localStorage.removeItem(AUTH_TOKEN_KEY);
}

function clearStoredToken() {
  setStoredToken('');
}

async function request(endpoint, options = {}) {
  const authToken = getStoredToken();
  const { headers: extraHeaders = {}, ...restOptions } = options;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...extraHeaders,
    },
    ...restOptions,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed.' }));
    throw new Error(error.message || 'Request failed.');
  }

  return response.json();
}

export const api = {
  getToken: getStoredToken,
  setToken: setStoredToken,
  clearToken: clearStoredToken,
  login: (payload) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  }),
  health: () => request('/health'),
  getPatients: () => request('/patients'),
  createPatient: (payload) => request('/patients', { method: 'POST', body: JSON.stringify(payload) }),
  getAppointments: () => request('/appointments'),
  createAppointment: (payload) => request('/appointments', { method: 'POST', body: JSON.stringify(payload) }),
  getConsultations: () => request('/consultations'),
  createConsultation: (payload) => request('/consultations', { method: 'POST', body: JSON.stringify(payload) }),
  getPharmacy: () => request('/pharmacy'),
  createMedicine: (payload) => request('/pharmacy', { method: 'POST', body: JSON.stringify(payload) }),
  getLabRequests: () => request('/lab-requests'),
  createLabRequest: (payload) => request('/lab-requests', { method: 'POST', body: JSON.stringify(payload) }),
  getAIInsights: () => request('/ai-insights'),
  getDashboardSummary: () => request('/dashboard-summary'),
};

export default api;
