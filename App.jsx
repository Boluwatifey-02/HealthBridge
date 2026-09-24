import { useEffect, useState } from 'react';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import PatientRegistrationPage from './pages/PatientRegistrationPage';
import ClinicalCarePage from './pages/ClinicalCarePage';
import PharmacyPage from './pages/PharmacyPage';
import LaboratoryPage from './pages/LaboratoryPage';
import AIInsightsPage from './pages/AIInsightsPage';
import SecurityPage from './pages/SecurityPage';
import api from './services/api';
const initialPatients = [
  {
    id: 'HB-10248',
    name: 'Amina Yusuf',
    age: 34,
    gender: 'Female',
    phone: '+234 803 421 7782',
    condition: 'Hypertension',
    lastVisit: '08 Sep 2026',
    status: 'Active',
    address: 'Ikeja, Lagos',
    allergies: 'None',
  },
  {
    id: 'HB-10247',
    name: 'David Okafor',
    age: 42,
    gender: 'Male',
    phone: '+234 806 214 9031',
    condition: 'Type 2 Diabetes',
    lastVisit: '07 Sep 2026',
    status: 'Active',
    address: 'Surulere, Lagos',
    allergies: 'Penicillin',
  },
  {
    id: 'HB-10246',
    name: 'Chioma Eze',
    age: 28,
    gender: 'Female',
    phone: '+234 809 552 1840',
    condition: 'Asthma',
    lastVisit: '06 Sep 2026',
    status: 'Active',
    address: 'Yaba, Lagos',
    allergies: 'Dust',
  },
  {
    id: 'HB-10245',
    name: 'Ibrahim Musa',
    age: 51,
    gender: 'Male',
    phone: '+234 802 771 4562',
    condition: 'Malaria',
    lastVisit: '05 Sep 2026',
    status: 'Active',
    address: 'Agege, Lagos',
    allergies: 'None',
  },
  {
    id: 'HB-10244',
    name: 'Grace Adeyemi',
    age: 37,
    gender: 'Female',
    phone: '+234 805 334 9201',
    condition: 'Migraine',
    lastVisit: '03 Sep 2026',
    status: 'Active',
    address: 'Maryland, Lagos',
    allergies: 'Ibuprofen',
  },
];

function App() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [authError, setAuthError] = useState('');
  const [patientError, setPatientError] = useState('');
  const [patientLoading, setPatientLoading] = useState(false);
  const [page, setPage] = useState(() => {
    const path = window.location.pathname;

    if (path === '/login') return 'login';
    if (path === '/dashboard') return 'dashboard';
    if (path === '/patients') return 'patients';
    if (path === '/appointments') return 'appointments';
    if (path === '/patient-registration') return 'patient-registration';
    if (path === '/clinical-care') return 'clinical-care';
    if (path === '/pharmacy') return 'pharmacy';
    if (path === '/laboratory') return 'laboratory';
    if (path === '/ai-insights') return 'ai-insights';
    if (path === '/security') return 'security';
    if (api.getToken()) return 'dashboard';

    return 'home';
  });

  const loadPatients = async () => {
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
  };

  useEffect(() => {
    if (page === 'patients' || page === 'patient-registration') {
      loadPatients();
    }
  }, [page]);

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

      window.history.pushState({}, '', '/dashboard');
      setPage('dashboard');
    } catch (error) {
      setAuthError(error.message || 'Invalid email or password.');
      api.clearToken();
    }
  };

  const openPatients = () => {
    setSelectedPatient(null);
    window.history.pushState({}, '', '/patients');
    setPage('patients');
  };

  const openPatientRegistration = () => {
  window.history.pushState({}, '', '/patient-registration');
  setPage('patient-registration');
};

  const openClinicalCare = (patient) => {
  setSelectedPatient(patient);

  window.history.pushState({}, '', '/clinical-care');
  setPage('clinical-care');
};

  const handlePatientRegistered = async (patient) => {
    try {
      const createdPatient = await api.createPatient(patient);
      setPatients((currentPatients) => [createdPatient, ...currentPatients]);
      window.history.pushState({}, '', '/patients');
      setPage('patients');
      return;
    } catch (error) {
      console.error('Unable to register patient via backend:', error);
      throw error;
    }
  };

  const openAppointments = () => {
    window.history.pushState({}, '', '/appointments');
    setPage('appointments');
  };

  const openDashboard = () => {
  window.history.pushState({}, '', '/dashboard');
  setPage('dashboard');
};

const openLaboratory = () => {
  window.history.pushState({}, '', '/laboratory');
  setPage('laboratory');
};

const openAIInsights = () => {
  window.history.pushState({}, '', '/ai-insights');
  setPage('ai-insights');
};

const openPharmacy = () => {
  window.history.pushState({}, '', '/pharmacy');
  setPage('pharmacy');
};

const openSecurity = () => {
  window.history.pushState({}, '', '/security');
  setPage('security');
};

  if (page === 'login') {
    return <LoginPage onLogin={handleLogin} error={authError} />;
  }

  if (page === 'dashboard') {
    return( 
    <DashboardPage 
    onPatientsClick={openPatients}
    onAppointmentsClick={openAppointments}
    onLaboratoryClick={openLaboratory}
    onPharmacyClick={openPharmacy}
    />
    );
  }

  if (page === 'patients') {
    return(
       <PatientsPage
       patients={patients}
       onRegisterPatient={openPatientRegistration}
       onClinicalCare={openClinicalCare}
       isLoading={patientLoading}
       error={patientError}
       onRetryLoad={loadPatients}
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
    return <AppointmentsPage />;
  }
  
  if (page === 'pharmacy') {
  return <PharmacyPage 
  onBack={openDashboard} />;
}

if (page === 'laboratory') {
  return <LaboratoryPage onBack={openDashboard} />;
}

if (page === 'ai-insights') {
  return <AIInsightsPage onBack={openDashboard} />;
}

if (page === 'security') {
  return <SecurityPage onBack={openDashboard} />;
}

  return <LandingPage />;
  
}

export default App;