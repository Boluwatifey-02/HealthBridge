const STAFF_TOKEN_KEY = 'healthbridge_auth_token';
const PATIENT_TOKEN_KEY = 'healthbridge_patient_token';
const UNAUTHORIZED_EVENT = 'healthbridge:unauthorized';

const DEFAULT_API_URL = '/api';
const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim();

if (configuredApiUrl && /^(https?:\/\/localhost|127\.0\.0\.1)/.test(configuredApiUrl)) {
  console.warn(
    'VITE_API_URL points at a local development host. Set VITE_API_URL to the deployed backend URL for production builds.'
  );
}

const API_BASE_URL = (configuredApiUrl || DEFAULT_API_URL).replace(/\/+$/, '');

function readToken(key) {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(key) || '';
}

function writeToken(key, token) {
  if (typeof window === 'undefined') return;

  if (token) {
    localStorage.setItem(key, token);
  } else {
    localStorage.removeItem(key);
  }
}

/**
 * Which token to send.
 *
 * Staff and patient sessions are stored separately. A patient session must
 * never be sent to a staff route, and a staff session must never be sent to
 * the patient portal, so the caller states which one it is.
 */
function resolveToken(audience) {
  if (audience === 'patient') return readToken(PATIENT_TOKEN_KEY);
  return readToken(STAFF_TOKEN_KEY);
}

function clearTokens() {
  writeToken(STAFF_TOKEN_KEY, '');
  writeToken(PATIENT_TOKEN_KEY, '');
}

async function request(endpoint, options = {}) {
  const { audience = 'staff', headers: extraHeaders = {}, ...restOptions } = options;
  const authToken = resolveToken(audience);

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...extraHeaders,
    },
    ...restOptions,
  });

  if (response.status === 401) {
    // Only drop the session that actually failed, so an expired patient token
    // does not sign a member of staff out mid-shift.
    writeToken(audience === 'patient' ? PATIENT_TOKEN_KEY : STAFF_TOKEN_KEY, '');
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: { audience } }));
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed.' }));
    const failure = new Error(error.message || 'Request failed.');
    failure.status = response.status;
    throw failure;
  }

  // A 200 can still arrive with an empty or non-JSON body (proxy truncation, a
  // misconfigured route). Surface that plainly instead of leaking a SyntaxError
  // such as "Unexpected end of JSON input" to the user.
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    throw new Error('The server returned an empty response. Please try again in a moment.');
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error('The server returned an unreadable response.');
  }
}

function query(params) {
  const search = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, value);
  });

  const string = search.toString();
  return string ? `?${string}` : '';
}

/**
 * Paginated list endpoints answer with a bare array unless the caller asks for
 * the envelope, which is what carries the page size and total. The bare array
 * exists only so the interface published before this was deployed keeps
 * working; nothing new should rely on it.
 */
function listQuery(params) {
  return query({ format: 'envelope', ...(params || {}) });
}

export const UNAUTHORIZED_EVENT_NAME = UNAUTHORIZED_EVENT;
export { STAFF_TOKEN_KEY, PATIENT_TOKEN_KEY };

const post = (endpoint, payload, audience) =>
  request(endpoint, { method: 'POST', body: JSON.stringify(payload), audience });

export const api = {
  // ------------------------------------------------------------- session
  // Signing in to one portal ends any session in the other. Without this a
  // browser could hold a staff session and a patient session at the same time,
  // and the staff workspace would stay reachable behind the patient portal.
  getToken: () => readToken(STAFF_TOKEN_KEY),
  setToken: (token) => {
    writeToken(PATIENT_TOKEN_KEY, '');
    writeToken(STAFF_TOKEN_KEY, token);
  },
  getPatientToken: () => readToken(PATIENT_TOKEN_KEY),
  setPatientToken: (token) => {
    writeToken(STAFF_TOKEN_KEY, '');
    writeToken(PATIENT_TOKEN_KEY, token);
  },
  clearToken: () => writeToken(STAFF_TOKEN_KEY, ''),
  clearPatientToken: () => writeToken(PATIENT_TOKEN_KEY, ''),
  clearTokens,
  health: () => request('/health'),

  // ------------------------------------------------------------- contact
  submitContactMessage: (payload) => post('/contact', payload),
  getContactMessages: (params) => request(`/admin/contact-messages${query(params)}`),

  // ---------------------------------------------------------- staff auth
  login: (payload) => post('/auth/login', payload),
  me: () => request('/auth/me'),
  forgotPassword: (email) => post('/auth/forgot-password', { email }),
  verifyResetToken: (token) => request(`/auth/reset-password/verify${query({ token })}`),
  resetPassword: (payload) => post('/auth/reset-password', payload),

  // -------------------------------------------------------- patient auth
  patientLogin: (payload) => post('/patient-auth/login', payload, 'patient'),
  patientRegister: (payload) => post('/patient-auth/register', payload, 'patient'),
  patientSetPassword: (payload) => post('/patient-auth/set-password', payload),
  patientForgotPassword: (email) => post('/patient-auth/forgot-password', { email }, 'patient'),
  verifyPatientResetToken: (token) =>
    request(`/patient-auth/reset-password/verify${query({ token })}`, { audience: 'patient' }),
  patientResetPassword: (payload) => post('/patient-auth/reset-password', payload, 'patient'),
  getMyRecord: () => request('/patient-auth/me', { audience: 'patient' }),

  // ------------------------------------------------------------ patients
  getPatients: (params) => request(`/patients${listQuery(params)}`),
  getPatient: (id) => request(`/patients/${encodeURIComponent(id)}`),
  getPatientTimeline: (id) => request(`/patients/${encodeURIComponent(id)}/timeline`),
  createPatient: (payload) => post('/patients', payload),
  updatePatient: (id, payload) =>
    request(`/patients/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deactivatePatient: (id) => request(`/patients/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // -------------------------------------------------------- appointments
  getAppointments: (params) => request(`/appointments${listQuery(params)}`),
  createAppointment: (payload) => post('/appointments', payload),
  updateAppointment: (id, payload) =>
    request(`/appointments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  cancelAppointment: (id) => request(`/appointments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getDoctors: () => request('/staff/doctors'),

  // ------------------------------------------------------- consultations
  getConsultations: (params) => request(`/consultations${listQuery(params)}`),
  createConsultation: (payload) => post('/consultations', payload),
  updateConsultation: (id, payload) =>
    request(`/consultations/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),

  // -------------------------------------------------------- prescriptions
  getPrescriptions: (params) => request(`/prescriptions${listQuery(params)}`),
  createPrescription: (payload) => post('/prescriptions', payload),
  dispensePrescription: (id) => post(`/prescriptions/${encodeURIComponent(id)}/dispense`, {}),
  cancelPrescription: (id) => post(`/prescriptions/${encodeURIComponent(id)}/cancel`, {}),

  // ------------------------------------------------------------- pharmacy
  getPharmacy: (params) => request(`/pharmacy${listQuery(params)}`),
  createMedicine: (payload) => post('/pharmacy', payload),
  updateMedicine: (id, payload) =>
    request(`/pharmacy/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),

  // ----------------------------------------------------------- laboratory
  getLabRequests: (params) => request(`/lab-requests${listQuery(params)}`),
  createLabRequest: (payload) => post('/lab-requests', payload),
  submitLabResult: (id, payload) => post(`/lab-requests/${encodeURIComponent(id)}/result`, payload),
  cancelLabRequest: (id) => post(`/lab-requests/${encodeURIComponent(id)}/cancel`, {}),

  // ---------------------------------------------------- dashboard/insights
  getDashboardSummary: () => request('/dashboard-summary'),
  getAIInsights: (params) => request(`/ai-insights${query(params)}`),

  // ---------------------------------------------------------------- admin
  getAnalytics: () => request('/admin/analytics'),
  getAuditLog: (params) => request(`/admin/audit-log${query(params)}`),
  getStaff: () => request('/admin/staff'),
  createStaff: (payload) => post('/admin/staff', payload),
  updateStaff: (id, payload) =>
    request(`/admin/staff/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
};

export default api;
