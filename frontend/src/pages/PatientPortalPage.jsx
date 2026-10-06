import { useCallback } from 'react';
import {
  CalendarDays,
  Pill,
  FlaskConical,
  LogOut,
  AlertTriangle,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import Brand from '../components/Brand';
import api from '../services/api';
import { useApiData } from '../hooks/useApiData';
import './PatientPortalPage.css';

function formatDate(value) {
  if (!value) return 'Not recorded';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const future = (value) => new Date(value) >= new Date(new Date().toDateString());

/**
 * Everything a patient may see about themselves.
 *
 * The record is resolved from the signed patient token rather than from an id in
 * the page, so there is no way to reach another patient's data by editing the
 * request. The staff session token is never used here.
 */
function PatientPortalPage({ onLogout }) {
  const loadRecord = useCallback(() => api.getMyRecord(), []);
  const { data, loading, error, refresh } = useApiData(loadRecord, []);

  const patient = data?.patient;

  return (
    <main className="patient-portal-page">
      <header className="patient-portal-header">
        <Brand />

        <div className="patient-portal-header-right">
          <span>Patient portal</span>

          <div className="patient-portal-header-actions">
            <button
              type="button"
              className="patient-portal-header-button"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw size={15} />
              Refresh
            </button>

            <button type="button" className="patient-portal-header-button" onClick={onLogout}>
              <LogOut size={15} />
              Sign out
            </button>

            <div className="patient-portal-user" title={patient?.fullName || ''}>
              {(patient?.fullName || 'P').charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <div className="patient-portal-container">
        <section className="patient-portal-welcome">
          <div>
            <span className="patient-portal-label">MY HEALTH RECORD</span>
            <h1>{patient ? `Hello, ${patient.fullName.split(' ')[0]}.` : 'Your record.'}</h1>
            <p>
              {patient?.lastVisit
                ? `You were last seen on ${formatDate(patient.lastVisit)}.`
                : 'Your appointments, prescriptions and results appear below.'}
            </p>
          </div>
        </section>

        {error && (
          <section className="patient-portal-error" role="alert">
            <AlertTriangle size={16} />
            <span>Could not load your record: {error}</span>
            <button type="button" onClick={refresh}>Try again</button>
          </section>
        )}

        {loading && !data && (
          <div className="patient-portal-loading">Loading your record…</div>
        )}

        {patient && (
          <>
            <section className="patient-portal-stats">
              <article className="patient-portal-stat-card">
                <div className="patient-portal-stat-icon">
                  <CalendarDays size={20} />
                </div>
                <span>Appointments</span>
                <strong>{(data.appointments || []).length}</strong>
                <small>booked and not cancelled</small>
              </article>

              <article className="patient-portal-stat-card">
                <div className="patient-portal-stat-icon">
                  <Pill size={20} />
                </div>
                <span>Prescriptions</span>
                <strong>{(data.prescriptions || []).length}</strong>
                <small>issued to you</small>
              </article>

              <article className="patient-portal-stat-card">
                <div className="patient-portal-stat-icon">
                  <FlaskConical size={20} />
                </div>
                <span>Lab requests</span>
                <strong>{(data.labResults || []).length}</strong>
                <small>tests requested</small>
              </article>

              <article className="patient-portal-stat-card">
                <div className="patient-portal-stat-icon">
                  <UserRound size={20} />
                </div>
                <span>Blood group</span>
                <strong>{patient.bloodGroup || '—'}</strong>
                <small>genotype {patient.genotype || '—'}</small>
              </article>
            </section>

            <section className="patient-portal-main-grid">
              <article className="patient-portal-panel">
                <div className="patient-portal-panel-heading">
                  <div>
                    <span className="patient-portal-label">SCHEDULE</span>
                    <h2>Your appointments</h2>
                  </div>
                </div>

                <div className="patient-appointment-list">
                  {(data.appointments || []).length > 0 ? (
                    data.appointments.map((appointment) => (
                      <div className="patient-appointment-row" key={appointment.id}>
                        <div className="patient-appointment-time">
                          {formatDate(appointment.date).split(' ').slice(0, 2).join(' ')}
                        </div>
                        <div>
                          <strong>{appointment.reason || 'Consultation'}</strong>
                          <span>
                            {appointment.time}
                            {appointment.provider ? ` · ${appointment.provider}` : ''}
                            {future(appointment.date) ? ' · upcoming' : ''}
                          </span>
                        </div>
                        <span
                          className={`patient-appointment-status ${
                            appointment.status === 'Pending' ? 'pending' : 'confirmed'
                          }`}
                        >
                          {appointment.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="patient-appointment-row">
                      <div className="patient-appointment-time">—</div>
                      <div>
                        <strong>No appointments on record</strong>
                        <span>Book one at reception.</span>
                      </div>
                      <span className="patient-appointment-status pending">None</span>
                    </div>
                  )}
                </div>
              </article>

              <article className="patient-portal-panel">
                <div className="patient-portal-panel-heading">
                  <div>
                    <span className="patient-portal-label">MEDICINE</span>
                    <h2>Your prescriptions</h2>
                  </div>
                </div>

                <div className="patient-activity-list">
                  {(data.prescriptions || []).length > 0 ? (
                    data.prescriptions.map((prescription) => (
                      <div className="patient-activity-row" key={prescription.id}>
                        <div>
                          <strong>{prescription.medicineName}</strong>
                          <span>
                            {prescription.dosage} · {prescription.frequency} ·{' '}
                            {prescription.duration} — {prescription.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="patient-activity-row">
                      <div>
                        <strong>No prescriptions</strong>
                        <span>Anything a doctor prescribes will appear here.</span>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            </section>

            <section className="patient-portal-panel">
              <div className="patient-portal-panel-heading">
                <div>
                  <span className="patient-portal-label">LABORATORY</span>
                  <h2>Test results</h2>
                </div>
              </div>

              <div className="patient-lab-list">
                {(data.labResults || []).length > 0 ? (
                  data.labResults.map((request) => (
                    <div className="patient-lab-row" key={request.id}>
                      <div className="patient-appointment-time">
                        {formatDate(request.requestDate).split(' ').slice(0, 2).join(' ')}
                      </div>
                      <div>
                        <strong>{request.testName}</strong>
                        <span>
                          {request.result
                            ? request.result
                            : 'No result has been recorded yet.'}
                        </span>
                      </div>
                      <span className="patient-appointment-status pending">{request.status}</span>
                    </div>
                  ))
                ) : (
                  <div className="patient-lab-row">
                    <div className="patient-appointment-time">—</div>
                    <div>
                      <strong>No laboratory requests</strong>
                      <span>Tests your doctor requests will appear here.</span>
                    </div>
                    <span className="patient-appointment-status pending">None</span>
                  </div>
                )}
              </div>
            </section>

            <section className="patient-portal-panel">
              <div className="patient-portal-panel-heading">
                <div>
                  <span className="patient-portal-label">ABOUT YOU</span>
                  <h2>Details the clinic holds</h2>
                </div>
              </div>

              <div className="patient-details-list">
                {[
                  ['Date of birth / age', patient.age ? `${patient.age} years` : 'Not recorded'],
                  ['Gender', patient.gender || 'Not recorded'],
                  ['Phone', patient.phone || 'Not recorded'],
                  ['Email', patient.email || 'Not recorded'],
                  ['Allergies', patient.allergies || 'None recorded'],
                  ['Current condition', patient.condition || 'None recorded'],
                ].map(([label, value]) => (
                  <div className="patient-details-row" key={label}>
                    <span className="patient-details-label">{label}</span>
                    <span className="patient-details-value">{value}</span>
                  </div>
                ))}
              </div>

              <p className="patient-portal-note">
                If something here is wrong, tell reception and they can correct
                your record.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default PatientPortalPage;
