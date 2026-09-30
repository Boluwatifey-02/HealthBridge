import { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  Users,
  ChevronRight,
  ArrowLeft,
  CalendarDays,
  Phone,
  FileText,
  Activity,
  Stethoscope,
  Pill,
  LogOut,
} from 'lucide-react';
import Brand from '../components/Brand';
import api from '../services/api';
import './PatientsPage.css';

function isVisitThisMonth(lastVisit) {
  if (!lastVisit) {
    return false;
  }

  const parsed = new Date(lastVisit);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const now = new Date();
  return parsed.getFullYear() === now.getFullYear() && parsed.getMonth() === now.getMonth();
}

function PatientsPage({
  patients,
  onRegisterPatient,
  onClinicalCare,
  isLoading,
  error,
  onRetryLoad,
  onLogout,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  useEffect(() => {
    if (!selectedPatient?.id) {
      setTimeline(null);
      setHistoryError(null);
      return;
    }

    let isMounted = true;

    // One call for everything known about this patient. The previous version
    // fetched every consultation in the clinic and filtered in the browser,
    // which returned an empty history whenever the list was paginated.
    const loadTimeline = async () => {
      setIsHistoryLoading(true);
      setHistoryError(null);

      try {
        const result = await api.getPatientTimeline(selectedPatient.id);

        if (isMounted) setTimeline(result);
      } catch (loadError) {
        if (isMounted) {
          setTimeline(null);
          setHistoryError(loadError.message || 'The patient record could not be loaded.');
        }
      } finally {
        if (isMounted) setIsHistoryLoading(false);
      }
    };

    loadTimeline();

    return () => {
      isMounted = false;
    };
  }, [selectedPatient?.id]);

  const history = timeline?.consultations || [];
  const counts = timeline?.counts || {};

  const filteredPatients = (patients || []).filter((patient) => {
    const search = searchTerm.toLowerCase();

    return (
      (patient.name || '').toLowerCase().includes(search) ||
      (patient.id || '').toLowerCase().includes(search) ||
      (patient.condition || '').toLowerCase().includes(search)
    );
  });

  if (selectedPatient) {
    return (
  
      <main className="patients-page">
        <header className="patients-header">
          <Brand />

          <div className="patients-header-user">
            <span>Healthcare Staff</span>

            {onLogout && (
              <button
                type="button"
                className="patients-header-button"
                onClick={onLogout}
              >
                <LogOut size={15} />
                Log out
              </button>
            )}

            <div className="patients-user-avatar">A</div>
          </div>
        </header>

        <div className="patients-container">
          <button
            type="button"
            className="back-button"
            onClick={() => setSelectedPatient(null)}
          >
            <ArrowLeft size={16} />
            Back to patient records
          </button>
          <button
            type="button"
            className="clinical-care-button"
            onClick={() => onClinicalCare(selectedPatient)}
          >
  <Stethoscope size={17} />
  Clinical Care
</button>

          <section className="patient-profile-header">
            <div className="patient-profile-avatar">
              {(selectedPatient.name || 'U').charAt(0)}
            </div>

            <div>
              <span className="patients-label">
                PATIENT {selectedPatient.id}
              </span>

              <h1>{selectedPatient.name}</h1>

              <p>
                {selectedPatient.age} years · {selectedPatient.gender} ·{' '}
                {selectedPatient.status}
              </p>
            </div>
          </section>

          <section className="patient-information-grid">
            <article className="patient-information-card">
              <div className="patient-card-heading">
                <Phone size={18} />
                <h2>Contact information</h2>
              </div>

              <div className="patient-detail">
                <span>Phone</span>
                <strong>{selectedPatient.phone}</strong>
              </div>

              <div className="patient-detail">
                <span>Address</span>
                <strong>{selectedPatient.address}</strong>
              </div>
            </article>

            <article className="patient-information-card">
              <div className="patient-card-heading">
                <Activity size={18} />
                <h2>Medical information</h2>
              </div>

              <div className="patient-detail">
                <span>Current condition</span>
                <strong>{selectedPatient.condition}</strong>
              </div>

              <div className="patient-detail">
                <span>Allergies</span>
                <strong>{selectedPatient.allergies}</strong>
              </div>
            </article>

            <article className="patient-information-card">
              <div className="patient-card-heading">
                <CalendarDays size={18} />
                <h2>Visit information</h2>
              </div>

              <div className="patient-detail">
                <span>Last visit</span>
                <strong>{selectedPatient.lastVisit}</strong>
              </div>

              <div className="patient-detail">
                <span>Patient ID</span>
                <strong>{selectedPatient.id}</strong>
              </div>
            </article>

            <article className="patient-information-card">
              <div className="patient-card-heading">
                <FileText size={18} />
                <h2>Recorded activity</h2>
              </div>

              {isHistoryLoading && (
                <div className="patient-detail">
                  <span>Loading</span>
                  <strong>Counting records…</strong>
                </div>
              )}

              {!isHistoryLoading && counts.appointments !== undefined && (
                <>
                  <div className="patient-detail">
                    <span>Consultations</span>
                    <strong>
                      {counts.consultations} ({counts.completedConsultations} with a
                      diagnosis)
                    </strong>
                  </div>

                  <div className="patient-detail">
                    <span>Appointments</span>
                    <strong>{counts.appointments}</strong>
                  </div>

                  <div className="patient-detail">
                    <span>Prescriptions</span>
                    <strong>{counts.prescriptions}</strong>
                  </div>

                  <div className="patient-detail">
                    <span>Laboratory requests</span>
                    <strong>{counts.labRequests}</strong>
                  </div>
                </>
              )}
            </article>
          </section>

          {historyError && (
            <section className="patient-history-card">
              <div className="medical-history-row">
                <div className="history-date">—</div>
                <div>
                  <strong>Could not load this record</strong>
                  <span>{historyError}</span>
                </div>
                <span className="history-status">Pending</span>
              </div>
            </section>
          )}

          <section className="patient-history-card">
            <div className="patient-card-heading">
              <FileText size={18} />
              <div>
                <h2>Medical history</h2>
                <p>Previous patient visits and clinical information.</p>
              </div>
            </div>

            {history.map((consultation) => (
            <div className="medical-history-row" key={consultation.id}>
              <div className="history-date">
                {new Date(consultation.date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>

              <div>
                <strong>{consultation.diagnosis || 'Clinical consultation'}</strong>
                <span>
                  {consultation.complaint || 'Consultation recorded.'}
                  {consultation.treatment ? ` ${consultation.treatment}` : ''}
                </span>
              </div>

              <span className="history-status">Completed</span>
            </div>
            ))}

            {isHistoryLoading && (
              <div className="medical-history-row">
                <div className="history-date">—</div>

                <div>
                  <strong>Loading clinical history</strong>
                  <span>Retrieving consultations from the database.</span>
                </div>

                <span className="history-status">Pending</span>
              </div>
            )}

            {!isHistoryLoading && history.length === 0 && (
              <div className="medical-history-row">
                <div className="history-date">—</div>

                <div>
                  <strong>No consultations recorded</strong>
                  <span>
                    Saved clinical consultations for this patient will appear here.
                  </span>
                </div>

                <span className="history-status">Pending</span>
              </div>
            )}
          </section>

          {(timeline?.prescriptions?.length > 0 || timeline?.labRequests?.length > 0) && (
            <section className="patient-history-card">
              <div className="patient-card-heading">
                <Pill size={18} />
                <div>
                  <h2>Prescriptions and laboratory work</h2>
                  <p>Everything ordered for this patient, with its current state.</p>
                </div>
              </div>

              {(timeline.prescriptions || []).map((prescription) => (
                <div className="medical-history-row" key={`rx-${prescription.id}`}>
                  <div className="history-date">
                    {prescription.createdAt
                      ? new Date(prescription.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </div>

                  <div>
                    <strong>{prescription.medicineName}</strong>
                    <span>
                      {prescription.dosage} · {prescription.frequency} ·{' '}
                      {prescription.duration} · {prescription.quantity} units
                      {prescription.instructions ? ` — ${prescription.instructions}` : ''}
                    </span>
                  </div>

                  <span className="history-status">{prescription.status}</span>
                </div>
              ))}

              {(timeline.labRequests || []).map((request) => (
                <div className="medical-history-row" key={`lab-${request.id}`}>
                  <div className="history-date">
                    {request.requestDate
                      ? new Date(request.requestDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </div>

                  <div>
                    <strong>{request.testName}</strong>
                    <span>
                      {request.resultText
                        ? request.resultText
                        : request.notes || 'No result recorded yet.'}
                    </span>
                  </div>

                  <span className="history-status">{request.status}</span>
                </div>
              ))}
            </section>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="patients-page">
      <header className="patients-header">
        <Brand />

        <div className="patients-header-user">
          <span>Healthcare Staff</span>
          <div className="patients-user-avatar">A</div>
        </div>
      </header>

      <div className="patients-container">
        <section className="patients-page-heading">
          <div>
            <span className="patients-label">HEALTHBRIDGE RECORDS</span>
            <h1>Patient records.</h1>
            <p>
              Search, review, and manage digital patient information from one
              connected record.
            </p>
          </div>

          <button type="button" 
          className="register-patient-button"
          onClick={onRegisterPatient}>
            <Plus size={17} />Register patient
          </button>
        </section>

        <section className="patients-overview">
          <div className="patients-overview-card">
            <div className="patients-overview-icon">
              <Users size={20} />
            </div>

            <div>
              <span>Total patients</span>
              <strong>{isLoading ? '—' : (patients || []).length.toLocaleString()}</strong>
            </div>
          </div>

          <div className="patients-overview-card">
            <div className="patients-overview-icon">
              <Activity size={20} />
            </div>

            <div>
              <span>Active records</span>
              <strong>
                {isLoading
                  ? '—'
                  : (patients || []).filter((patient) => patient.status !== 'Inactive').length.toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="patients-overview-card">
            <div className="patients-overview-icon">
              <CalendarDays size={20} />
            </div>

            <div>
              <span>Visits this month</span>
              <strong>
                {isLoading ? '—' : (patients || []).filter((patient) => isVisitThisMonth(patient.lastVisit)).length.toLocaleString()}
              </strong>
            </div>
          </div>
        </section>

        <section className="patients-records-card">
          <div className="patients-records-heading">
            <div>
              <span className="patients-label">DIGITAL RECORDS</span>
              <h2>All patients</h2>
            </div>

            <div className="patient-search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search name, patient ID or condition..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className="patients-table">
            <div className="patients-table-header">
              <span>Patient</span>
              <span>Patient ID</span>
              <span>Condition</span>
              <span>Last visit</span>
              <span>Status</span>
              <span></span>
            </div>

            {isLoading && (
              <div className="no-patients">
                <Search size={22} />
                <strong>Loading patients...</strong>
                <span>Fetching real patient records from the database.</span>
              </div>
            )}

            {!isLoading && error && (
              <div className="no-patients">
                <Search size={22} />
                <strong>Unable to load patients</strong>
                <span>{error}</span>
                {onRetryLoad && (
                  <button type="button" onClick={onRetryLoad} style={{ marginTop: '0.75rem' }}>
                    Retry
                  </button>
                )}
              </div>
            )}

            {!isLoading && !error && filteredPatients.map((patient) => (
              <button
                type="button"
                className="patient-table-row"
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
              >
                <div className="patient-name-cell">
                  <div className="patient-small-avatar">
                    {(patient.name || 'P').charAt(0)}
                  </div>

                  <div>
                    <strong>{patient.name}</strong>
                    <span>
                      {patient.age} years · {patient.gender}
                    </span>
                  </div>
                </div>

                <span>{patient.id}</span>

                <span>{patient.condition}</span>

                <span>{patient.lastVisit}</span>

                <span className="patient-status">{patient.status}</span>

                <ChevronRight size={17} />
              </button>
            ))}

            {!isLoading && !error && filteredPatients.length === 0 && (
              <div className="no-patients">
                <Search size={22} />
                <strong>No patients found</strong>
                <span>Try another name, patient ID, or condition.</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default PatientsPage;