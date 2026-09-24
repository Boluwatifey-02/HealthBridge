import { useState } from 'react';
import {
  Search,
  Plus,
  Users,
  ChevronRight,
  ArrowLeft,
  UserRound,
  CalendarDays,
  Phone,
  MapPin,
  FileText,
  Activity,
  Stethoscope, 
} from 'lucide-react';
import Brand from '../components/Brand';
import './PatientsPage.css';


function PatientsPage({patients, onRegisterPatient, onClinicalCare, isLoading, error, onRetryLoad}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);

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
              {selectedPatient.name.charAt(0)}
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
          </section>

          <section className="patient-history-card">
            <div className="patient-card-heading">
              <FileText size={18} />
              <div>
                <h2>Medical history</h2>
                <p>Previous patient visits and clinical information.</p>
              </div>
            </div>

            <div className="medical-history-row">
              <div className="history-date">08 Sep 2026</div>

              <div>
                <strong>Routine consultation</strong>
                <span>
                  Patient reviewed for {selectedPatient.condition}.
                  Treatment and follow-up instructions provided.
                </span>
              </div>

              <span className="history-status">Completed</span>
            </div>

            <div className="medical-history-row">
              <div className="history-date">15 Aug 2026</div>

              <div>
                <strong>Follow-up visit</strong>
                <span>
                  Previous condition reviewed and patient progress recorded.
                </span>
              </div>

              <span className="history-status">Completed</span>
            </div>
          </section>
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
              <strong>1,248</strong>
            </div>
          </div>

          <div className="patients-overview-card">
            <div className="patients-overview-icon">
              <Activity size={20} />
            </div>

            <div>
              <span>Active records</span>
              <strong>1,186</strong>
            </div>
          </div>

          <div className="patients-overview-card">
            <div className="patients-overview-icon">
              <CalendarDays size={20} />
            </div>

            <div>
              <span>Visits this month</span>
              <strong>326</strong>
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