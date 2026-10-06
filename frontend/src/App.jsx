import { useCallback, useEffect, useState } from 'react';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import PatientRegistrationPage from './pages/PatientRegistrationPage';
import ClinicalCarePage from './pages/ClinicalCarePage';
import PharmacyPage from './pages/PharmacyPage';
import LaboratoryPage from './pages/LaboratoryPage';
import AIInsightsPage from './pages/AIInsightsPage';
import SecurityPage from './pages/SecurityPage';
import PatientLoginPage from './pages/PatientLoginPage';
import PatientPortalPage from './pages/PatientPortalPage';
import PatientSelfRegistrationPage from './pages/PatientSelfRegistrationPage';
import api, { UNAUTHORIZED_EVENT_NAME } from './services/api';

const ROUTES = {
  '/': 'home',
  '/login': 'login',
  '/forgot-password': 'forgot-password',
  '/reset-password': 'reset-password',
  '/dashboard': 'dashboard',
  '/patients': 'patients',
  '/appointments': 'appointments',
  '/patient-registration': 'patient-registration',
  '/clinical-care': 'clinical-care',
  '/pharmacy': 'pharmacy',
  '/laboratory': 'laboratory',
  '/ai-insights': 'ai-insights',
  '/security': 'security',
  '/patient-portal': 'patient-login',
  '/patient-reset-password': 'patient-reset-password',
  '/patient-forgot-password': 'patient-forgot-password',
  '/patient-register': 'patient-register',
  '/my-record': 'patient-portal',
};

const PAGE_PATHS = Object.entries(ROUTES).reduce((accumulator, [path, page]) => {
  accumulator[page] = path;
  return accumulator;
}, {});

// Staff workspace pages. A patient session is never sent to any of these, so a
// patient cannot end up in the clinical workspace by following a link.
const STAFF_ONLY_PAGES = new Set([
  'dashboard',
  'patients',
  'appointments',
  'patient-registration',
  'clinical-care',
  'pharmacy',
  'laboratory',
  'ai-insights',
  'security',
]);

function resolvePage() {
  const path = window.location.pathname;
  const matched = ROUTES[path];

  if (matched) {
    // A patient who already has a session and reloads the portal link should see
    // their record, not a second sign-in form they have no reason to fill in.
    if (matched === 'patient-login' && api.getPatientToken()) {
      return 'patient-portal';
    }

    return matched;
  }

  if (api.getToken()) return 'dashboard';
  if (api.getPatientToken()) return 'patient-portal';
  return 'home';
}

// The reset link carries its single-use token in the query string.
function readResetToken() {
  return new URLSearchParams(window.location.search).get('token') || '';
}

function App() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [authError, setAuthError] = useState('');
  const [patientAuthError, setPatientAuthError] = useState('');
  const [patientError, setPatientError] = useState('');
  const [patientLoading, setPatientLoading] = useState(false);
  const [page, setPage] = useState(resolvePage);

  // The signed-in member of staff. The dashboard greets them by name and states
  // the role in use, which it can only do once this is loaded from the server
  // rather than guessed from the page being open.
  const [staffUser, setStaffUser] = useState(null);

  const loadStaffUser = useCallback(async () => {
    if (!api.getToken()) {
      setStaffUser(null);
      return;
    }

    try {
      const response = await api.me();
      setStaffUser(response.user || null);
    } catch {
      setStaffUser(null);
    }
  }, []);

  useEffect(() => {
    loadStaffUser();
  }, [loadStaffUser, page]);

  const navigate = useCallback((nextPage) => {
    const path = PAGE_PATHS[nextPage] || '/';
    window.history.pushState({}, '', path);
    setPage(nextPage);
  }, []);

  const handleUnauthorized = useCallback((event) => {
    // The event carries which session ended, so an expired patient session does
    // not sign a member of staff out and vice versa.
    if (event?.detail?.audience === 'patient') {
      setPatientAuthError('Your portal session has ended. Please sign in again.');
      setPage('patient-login');
      return;
    }

    setAuthError('Your session has ended. Please sign in again.');
    setPage('login');
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setPage(resolvePage());
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener(UNAUTHORIZED_EVENT_NAME, handleUnauthorized);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener(UNAUTHORIZED_EVENT_NAME, handleUnauthorized);
    };
  }, [handleUnauthorized]);

  const loadPatients = useCallback(async () => {
    if (!api.getToken()) {
      setPatients([]);
      setPatientError('');
      return;
    }

    setPatientLoading(true);
    setPatientError('');

    try {
      const data = await api.getPatients();
      setPatients(data?.patients || []);
    } catch (error) {
      console.error('Unable to fetch patients from backend:', error);
      setPatientError(error.message || 'Unable to load patient records.');
      setPatients([]);
    } finally {
      setPatientLoading(false);
    }
  }, []);

  const handlePatientLogin = async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '').trim();

    if (!email || !password) {
      setPatientAuthError('Please enter your email and password.');
      return;
    }

    try {
      const response = await api.patientLogin({ email, password });
      api.setPatientToken(response.token);
      setStaffUser(null);
      setPatientAuthError('');
      navigate('patient-portal');
    } catch (error) {
      setPatientAuthError(error.message || 'Incorrect email or password.');
      api.clearPatientToken();
    }
  };

  const handlePatientLogout = useCallback(() => {
    api.clearPatientToken();
    setPatientAuthError('');
    navigate('patient-login');
  }, [navigate]);

  useEffect(() => {
    if (page === 'patients' || page === 'patient-registration') {
      loadPatients();
    }
  }, [page, loadPatients]);

  const handleLogin = async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '').trim();

    if (!email || !password) {
      setAuthError('Please enter your email and password.');
      return;
    }

    try {
      const response = await api.login({ email, password });
      api.setToken(response.token);
      setAuthError('');
      setStaffUser(response.user || null);
      navigate('dashboard');
    } catch (error) {
      setAuthError(error.message || 'Invalid email or password.');
      setStaffUser(null);
      api.clearToken();
    }
  };

  const openLogin = useCallback(() => {
    setAuthError('');
    navigate('login');
  }, [navigate]);

  const openPatients = useCallback(() => {
    setSelectedPatient(null);
    navigate('patients');
  }, [navigate]);

  const openPatientRegistration = useCallback(() => {
    navigate('patient-registration');
  }, [navigate]);

  const openClinicalCare = useCallback((patient) => {
    setSelectedPatient(patient);
    navigate('clinical-care');
  }, [navigate]);

  const handlePatientRegistered = async (patient) => {
    try {
      const createdPatient = await api.createPatient(patient);
      setPatients((currentPatients) => [createdPatient, ...currentPatients]);
      navigate('patients');
    } catch (error) {
      console.error('Unable to register patient via backend:', error);
      throw error;
    }
  };

  const handleLogout = useCallback(() => {
    api.clearToken();
    setPatients([]);
    setSelectedPatient(null);
    setStaffUser(null);
    setAuthError('');
    navigate('login');
  }, [navigate]);

  const openAppointments = useCallback(() => navigate('appointments'), [navigate]);
  const openDashboard = useCallback(() => navigate('dashboard'), [navigate]);
  const openLaboratory = useCallback(() => navigate('laboratory'), [navigate]);
  const openAIInsights = useCallback(() => navigate('ai-insights'), [navigate]);
  const openPharmacy = useCallback(() => navigate('pharmacy'), [navigate]);
  const openSecurity = useCallback(() => navigate('security'), [navigate]);

  const openForgotPassword = useCallback(() => {
    setAuthError('');
    navigate('forgot-password');
  }, [navigate]);

  const finishPasswordReset = useCallback(() => {
    setAuthError('');
    navigate('login');
  }, [navigate]);

  const isAuthenticated = Boolean(api.getToken());
  const isPatientAuthenticated = Boolean(api.getPatientToken());

  if (page === 'home') {
    return (
      <LandingPage
        onLoginClick={openLogin}
        onPatientLoginClick={() => navigate('patient-login')}
      />
    );
  }

  if (page === 'patient-login') {
    return (
      <PatientLoginPage
        onLogin={handlePatientLogin}
        onForgotPassword={() => navigate('patient-forgot-password')}
        onRegisterClick={() => navigate('patient-register')}
        error={patientAuthError}
      />
    );
  }

  if (page === 'patient-register') {
    return (
      <PatientSelfRegistrationPage
        onBack={() => navigate('patient-login')}
        onRegistered={(response) => {
          if (response?.token) {
            api.setPatientToken(response.token);
            navigate('patient-portal');
          } else {
            navigate('patient-login');
          }
        }}
      />
    );
  }

  if (page === 'patient-forgot-password') {
    return (
      <ForgotPasswordPage
        audience="patient"
        onBackToLogin={() => navigate('patient-login')}
      />
    );
  }

  if (page === 'patient-reset-password') {
    return (
      <ResetPasswordPage
        audience="patient"
        token={readResetToken()}
        onBackToLogin={() => navigate('patient-login')}
        onResetComplete={() => navigate('patient-login')}
      />
    );
  }

  if (page === 'patient-portal') {
    if (!isPatientAuthenticated) {
      return (
        <PatientLoginPage
          onLogin={handlePatientLogin}
          onForgotPassword={() => navigate('patient-forgot-password')}
          error={patientAuthError}
        />
      );
    }

    return <PatientPortalPage onLogout={handlePatientLogout} />;
  }

  if (page === 'login') {
    return <LoginPage onLogin={handleLogin} onPatientLoginClick={() => navigate('patient-login')} onForgotPassword={openForgotPassword} error={authError} />;
  }

  // These two pages must stay reachable whether or not a session exists.
  if (page === 'forgot-password') {
    return <ForgotPasswordPage onBackToLogin={openLogin} />;
  }

  if (page === 'reset-password') {
    return (
      <ResetPasswordPage
        token={readResetToken()}
        onBackToLogin={openLogin}
        onResetComplete={finishPasswordReset}
      />
    );
  }

  // A patient session must not open the staff workspace, and a missing staff
  // session must not leave a blank screen.
  if (STAFF_ONLY_PAGES.has(page) && !isAuthenticated) {
    return <LoginPage onLogin={handleLogin} onPatientLoginClick={() => navigate('patient-login')} onForgotPassword={openForgotPassword} error={authError} />;
  }

  if (page === 'dashboard') {
    return (
      <DashboardPage
        user={staffUser}
        onPatientsClick={openPatients}
        onAppointmentsClick={openAppointments}
        onLaboratoryClick={openLaboratory}
        onPharmacyClick={openPharmacy}
        onAIInsightsClick={openAIInsights}
        onSecurityClick={openSecurity}
        onLogout={handleLogout}
      />
    );
  }

  if (page === 'patients') {
    return (
      <PatientsPage
        patients={patients}
        onRegisterPatient={openPatientRegistration}
        onClinicalCare={openClinicalCare}
        isLoading={patientLoading}
        error={patientError}
        onRetryLoad={loadPatients}
        onLogout={handleLogout}
      />
    );
  }

  if (page === 'patient-registration') {
    return (
      <PatientRegistrationPage
        onBack={openPatients}
        onPatientRegistered={handlePatientRegistered}
      />
    );
  }

  if (page === 'clinical-care') {
    return (
      <ClinicalCarePage
        patient={selectedPatient}
        onBack={openPatients}
      />
    );
  }

  if (page === 'appointments') {
    return <AppointmentsPage onLogout={handleLogout} />;
  }

  if (page === 'pharmacy') {
    return <PharmacyPage onBack={openDashboard} onLogout={handleLogout} />;
  }

  if (page === 'laboratory') {
    return <LaboratoryPage onBack={openDashboard} onLogout={handleLogout} />;
  }

  if (page === 'ai-insights') {
    return <AIInsightsPage onBack={openDashboard} onLogout={handleLogout} />;
  }

  if (page === 'security') {
    return <SecurityPage onBack={openDashboard} onLogout={handleLogout} />;
  }

  return (
    <LandingPage
      onLoginClick={openLogin}
      onPatientLoginClick={() => navigate('patient-login')}
    />
  );
}

export default App;