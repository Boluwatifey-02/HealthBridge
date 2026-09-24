import { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  CalendarDays,
  Clock3,
  UserRound,
  Stethoscope,
  CheckCircle2,
  CircleAlert,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import Brand from '../components/Brand';
import api from '../services/api';
import './AppointmentsPage.css';

const formatTime = (value) => {
  if (!value) {
    return 'Time unavailable';
  }

  const timeValue = String(value).trim();

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeValue)) {
    const [hours, minutes] = timeValue.split(':').map(Number);
    const formattedDate = new Date();
    formattedDate.setHours(hours, minutes, 0, 0);

    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(formattedDate);
  }

  return timeValue;
};

const normalizeAppointment = (appointment = {}) => ({
  id: appointment.id || 'N/A',
  time: formatTime(appointment.time || appointment.appointment_time),
  patient: appointment.patient || appointment.patient_name || appointment.full_name || 'Unknown patient',
  patientId: appointment.patientId || appointment.patient_id || 'N/A',
  doctor: appointment.provider || appointment.doctor || appointment.doctor_name || 'Dr. HealthBridge',
  department: 'Clinical Care',
  reason: appointment.reason || appointment.type || 'Consultation',
  status: appointment.status || 'Scheduled',
});

function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        setIsLoading(true);
        setError('');

        const data = await api.getAppointments();
        setAppointments(Array.isArray(data) ? data.map(normalizeAppointment) : []);
      } catch (loadError) {
        console.error('Unable to fetch appointments:', loadError);
        setError(loadError.message || 'Unable to load appointments from the backend.');
        setAppointments([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadAppointments();
  }, []);

  const filteredAppointments = (appointments || []).filter((appointment) => {
    const search = searchTerm.toLowerCase();

    return (
      (appointment.patient || '').toLowerCase().includes(search) ||
      (appointment.patientId || '').toLowerCase().includes(search) ||
      (appointment.doctor || '').toLowerCase().includes(search) ||
      (appointment.reason || '').toLowerCase().includes(search)
    );
  });

  if (selectedAppointment) {
    return (
      <main className="appointments-page">
        <header className="appointments-header">
          <Brand />

          <div className="appointments-header-user">
            <span>Healthcare Staff</span>
            <div className="appointments-user-avatar">A</div>
          </div>
        </header>

        <div className="appointments-container">
          <button
            type="button"
            className="appointment-back-button"
            onClick={() => setSelectedAppointment(null)}
          >
            <ArrowLeft size={16} />
            Back to appointments
          </button>

          <section className="appointment-detail-header">
            <div className="appointment-detail-icon">
              <CalendarDays size={24} />
            </div>

            <div>
              <span className="appointments-label">
                APPOINTMENT {selectedAppointment.id}
              </span>

              <h1>{selectedAppointment.patient}</h1>

              <p>
                {selectedAppointment.time} · {selectedAppointment.status}
              </p>
            </div>
          </section>

          <section className="appointment-detail-grid">
            <article className="appointment-information-card">
              <div className="appointment-card-heading">
                <UserRound size={18} />
                <h2>Patient information</h2>
              </div>

              <div className="appointment-detail-row">
                <span>Patient</span>
                <strong>{selectedAppointment.patient}</strong>
              </div>

              <div className="appointment-detail-row">
                <span>Patient ID</span>
                <strong>{selectedAppointment.patientId}</strong>
              </div>
            </article>

            <article className="appointment-information-card">
              <div className="appointment-card-heading">
                <Stethoscope size={18} />
                <h2>Clinical information</h2>
              </div>

              <div className="appointment-detail-row">
                <span>Healthcare provider</span>
                <strong>{selectedAppointment.doctor}</strong>
              </div>

              <div className="appointment-detail-row">
                <span>Department</span>
                <strong>{selectedAppointment.department}</strong>
              </div>
            </article>

            <article className="appointment-information-card">
              <div className="appointment-card-heading">
                <Clock3 size={18} />
                <h2>Appointment details</h2>
              </div>

              <div className="appointment-detail-row">
                <span>Time</span>
                <strong>{selectedAppointment.time}</strong>
              </div>

              <div className="appointment-detail-row">
                <span>Reason</span>
                <strong>{selectedAppointment.reason}</strong>
              </div>
            </article>
          </section>

          <section className="appointment-status-card">
            <div>
              <span className="appointments-label">APPOINTMENT STATUS</span>
              <h2>{selectedAppointment.status}</h2>
              <p>
                This appointment is currently marked as{' '}
                {selectedAppointment.status.toLowerCase()}.
              </p>
            </div>

            {selectedAppointment.status === 'Confirmed' ? (
              <CheckCircle2 size={30} />
            ) : (
              <CircleAlert size={30} />
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="appointments-page">
      <header className="appointments-header">
        <Brand />

        <div className="appointments-header-user">
          <span>Healthcare Staff</span>
          <div className="appointments-user-avatar">A</div>
        </div>
      </header>

      <div className="appointments-container">
        <section className="appointments-page-heading">
          <div>
            <span className="appointments-label">HEALTHBRIDGE SCHEDULE</span>
            <h1>Appointments.</h1>
            <p>
              Schedule, review, and manage patient appointments from one
              connected workspace.
            </p>
          </div>

          <button type="button" className="new-appointment-button">
            <Plus size={17} />
            New appointment
          </button>
        </section>

        <section className="appointments-overview">
          <div className="appointments-overview-card">
            <div className="appointments-overview-icon">
              <CalendarDays size={20} />
            </div>

            <div>
              <span>Today's appointments</span>
              <strong>{appointments.length}</strong>
            </div>
          </div>

          <div className="appointments-overview-card">
            <div className="appointments-overview-icon">
              <CheckCircle2 size={20} />
            </div>

            <div>
              <span>Confirmed</span>
              <strong>{appointments.filter((appointment) => appointment.status === 'Confirmed').length}</strong>
            </div>
          </div>

          <div className="appointments-overview-card">
            <div className="appointments-overview-icon">
              <Clock3 size={20} />
            </div>

            <div>
              <span>Pending</span>
              <strong>{appointments.filter((appointment) => appointment.status === 'Pending' || appointment.status === 'Scheduled').length}</strong>
            </div>
          </div>
        </section>

        <section className="appointments-records-card">
          <div className="appointments-records-heading">
            <div>
              <span className="appointments-label">TODAY'S SCHEDULE</span>
              <h2>Appointments</h2>
            </div>

            <div className="appointment-search">
              <Search size={17} />

              <input
                type="search"
                placeholder="Search patient, doctor or reason..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className="appointments-list">
            {isLoading && (
              <div className="no-appointments">
                <Clock3 size={22} />
                <strong>Loading appointments...</strong>
                <span>Fetching active appointment records from the database.</span>
              </div>
            )}

            {!isLoading && error && (
              <div className="no-appointments">
                <CircleAlert size={22} />
                <strong>Unable to load appointments</strong>
                <span>{error}</span>
              </div>
            )}

            {!isLoading && !error && filteredAppointments.map((appointment) => (
              <button
                type="button"
                className="appointment-row"
                key={appointment.id}
                onClick={() => setSelectedAppointment(appointment)}
              >
                <div className="appointment-time">
                  <Clock3 size={16} />
                  <strong>{appointment.time}</strong>
                </div>

                <div className="appointment-patient">
                  <div className="appointment-small-avatar">
                    {(appointment.patient || 'U').charAt(0)}
                  </div>

                  <div>
                    <strong>{appointment.patient}</strong>
                    <span>{appointment.patientId}</span>
                  </div>
                </div>

                <div className="appointment-doctor">
                  <span>Provider</span>
                  <strong>{appointment.doctor}</strong>
                </div>

                <div className="appointment-reason">
                  <span>Reason</span>
                  <strong>{appointment.reason}</strong>
                </div>

                <span
                  className={`appointment-status ${
                    appointment.status === 'Confirmed'
                      ? 'confirmed'
                      : 'pending'
                  }`}
                >
                  {appointment.status}
                </span>

                <ChevronRight size={17} />
              </button>
            ))}

            {!isLoading && !error && filteredAppointments.length === 0 && (
              <div className="no-appointments">
                <Search size={22} />
                <strong>No appointments found</strong>
                <span>
                  Try another patient, doctor, or appointment reason.
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default AppointmentsPage;