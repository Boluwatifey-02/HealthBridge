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
};

const PAGE_PATHS = Object.entries(ROUTES).reduce((accumulator, [path, page]) => {
  accumulator[page] = path;
  return accumulator;
}, {});

function resolvePage() {
  const path = window.location.pathname;
  const matched = ROUTES[path];

  if (matched) {
    return matched;
  }

  return api.getToken() ? 'dashboard' : 'home';
}

// The reset link carries its single-use token in the query string.
function readResetToken() {
  return new URLSearchParams(window.location.search).get('token') || '';
}

function App() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [authError, setAuthError] = useState('');
  const [patientError, setPatientError] = useState('');
  const [patientLoading, setPatientLoading] = useState(false);
  const [page, setPage] = useState(resolvePage);

  const navigate = useCallback((nextPage) => {
    const path = PAGE_PATHS[nextPage] || '/';
    window.history.pushState({}, '', path);
    setPage(nextPage);
  }, []);

  const handleUnauthorized = useCallback(() => {
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
      setPatients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Unable to fetch patients from backend:', error);
      setPatientError(error.message || 'Unable to load patient records.');
      setPatients([]);
    } finally {
      setPatientLoading(false);
    }
  }, []);

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
      navigate('dashboard');
    } catch (error) {
      setAuthError(error.message || 'Invalid email or password.');
      api.clearToken();
    }
  };

  const handleLogout = useCallback(() => {
    api.clearToken();
    setPatients([]);
    setSelectedPatient(null);
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

  const openAppointments = useCallback(() => navigate('appointments'), [navigate]);
  const openDashboard = useCallback(() => navigate('dashboard'), [navigate]);
  const openLaboratory = useCallback(() => navigate('laboratory'), [navigate]);
  const openAIInsights = useCallback(() => navigate('ai-insights'), [navigate]);
  const openPharmacy = useCallback(() => navigate('pharmacy'), [navigate]);
  const openSecurity = useCallback(() => navigate('security'), [navigate]);
  const openLogin = useCallback(() => {
    setAuthError('');
    navigate('login');
  }, [navigate]);

  const openForgotPassword = useCallback(() => {
    setAuthError('');
    navigate('forgot-password');
  }, [navigate]);

  const openResetPassword = useCallback(() => {
    setAuthError('');
    navigate('reset-password');
  }, [navigate]);

  const finishPasswordReset = useCallback(() => {
    setAuthError('');
    navigate('login');
  }, [navigate]);

  const isAuthenticated = Boolean(api.getToken());

  if (page === 'home') {
    return <LandingPage onLoginClick={openLogin} />;
  }

  if (page === 'login') {
    return <LoginPage onLogin={handleLogin} onForgotPassword={openForgotPassword} error={authError} />;
  }

  // These two pages must stay reachable whether or not a session exists.
  if (page === 'forgot-password') {
    return <ForgotPasswordPage onBackToLogin={openLogin} />;
  }

  if (page === 'reset-password') {
    return (
      <ResetPasswordPage
        token={readResetToken()}
        onBackToLogin={openResetPassword}
        onResetComplete={finishPasswordReset}
      />
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} onForgotPassword={openForgotPassword} error={authError} />;
  }

  if (page === 'dashboard') {
    return (
      <DashboardPage
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

  return <LandingPage onLoginClick={openLogin} />;
}

export default App;