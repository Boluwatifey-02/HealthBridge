import { useCallback, useState } from 'react';
import {
  ArrowLeft,
  UserRound,
  HeartPulse,
  Stethoscope,
  Activity,
  Pill,
  FileText,
  CalendarDays,
  Save,
} from 'lucide-react';
import Brand from '../components/Brand';
import api from '../services/api';
import { useApiData } from '../hooks/useApiData';
import './ClinicalCarePage.css';

function formatEncounterDate(value) {
  if (!value) return 'Date not recorded';

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? 'Date not recorded'
    : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ClinicalCarePage({ patient, onBack, onConsultationSaved }) {
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // Bumped after a save so the history below the form reloads and the record just
  // written is visible without a page refresh.
  const [reloadToken, setReloadToken] = useState(0);

  const loadHistory = useCallback(async () => {
    const response = await api.getConsultations({ patientId: patient.id, pageSize: 25 });

    return response.consultations || [];
  }, [patient.id]);

  const {
    data: history,
    loading: historyLoading,
    error: historyError,
    refresh: refreshHistory,
  } = useApiData(loadHistory, [patient.id, reloadToken], { enabled: Boolean(patient.id) });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!patient?.id) {
      setSubmitError('Please select a real patient before saving a consultation.');
      return;
    }

    const formData = new FormData(event.currentTarget);
    const complaint = String(formData.get('complaint') || '').trim();
    const diagnosis = String(formData.get('diagnosis') || '').trim();

    if (!complaint || !diagnosis) {
      setSubmitError('Chief complaint and diagnosis are required.');
      return;
    }

    try {
      setSubmitError('');
      setIsSubmitting(true);

      const vitals = [
      ['Blood pressure', formData.get('bloodPressure')],
      ['Temperature', formData.get('temperature')],
      ['Pulse rate', formData.get('pulse')],
      ['Weight', formData.get('weight')],
    ]
      .map(([label, value]) => `${label}: ${String(value || '').trim() || 'Not recorded'}`)
      .join(' | ');

    const symptoms = String(formData.get('symptoms') || '').trim();
    const notes = String(formData.get('notes') || '').trim();

    const clinicalNotes = [
      symptoms ? `Symptoms: ${symptoms}` : '',
      `Vitals - ${vitals}`,
      notes,
    ]
      .filter(Boolean)
      .join('\n');

      const consultation = {
        patientId: patient.id,
        complaint,
        diagnosis,
        treatment: String(formData.get('treatment') || '').trim() || 'Routine management plan',
        notes: clinicalNotes,
        followUp: String(formData.get('followUp') || '').trim(),
        date: new Date().toISOString(),
      };

      const createdConsultation = await api.createConsultation(consultation);

      if (onConsultationSaved) {
        onConsultationSaved(createdConsultation);
      }

      setSaved(true);
      setReloadToken((current) => current + 1);
    } catch (error) {
      console.error('Unable to save consultation via backend:', error);
      setSaved(false);
      setSubmitError(error.message || 'Unable to save the consultation to the database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="clinical-page">
      <header className="clinical-header">
        <div className="clinical-header-inner">
          <button
            type="button"
            className="clinical-back-button"
            onClick={onBack}
          >
            <ArrowLeft size={17} />
            Back to Patient Records
          </button>

          <Brand />
        </div>
      </header>

      <div className="clinical-container">
        <div className="clinical-heading">
          <div>
            <span className="clinical-label">CLINICAL CARE</span>
            <h1>Patient consultation</h1>
            <p>
              Review patient information and record clinical findings,
              diagnosis and treatment.
            </p>
          </div>

          <div className="clinical-date">
            <CalendarDays size={16} />
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>

        {patient && (
          <section className="patient-summary-card">
            <div className="patient-summary-icon">
              <UserRound size={22} />
            </div>

            <div className="patient-summary-main">
              <span>SELECTED PATIENT</span>
              <h2>{patient.name}</h2>
              <p>
                {patient.id} · {patient.age} years · {patient.gender}
              </p>
            </div>

            <div className="patient-summary-condition">
              <span>Current condition</span>
              <strong>{patient.condition}</strong>
            </div>
          </section>
        )}

        {/* The patient's existing record is shown above the form, so a clinician
            opening a patient sees their history rather than a blank page. */}
        <section className="clinical-card clinical-history">
          <div className="clinical-card-heading">
            <div className="clinical-card-icon">
              <FileText size={19} />
            </div>
            <div>
              <h2>Recorded encounters</h2>
              <p>
                {historyLoading
                  ? 'Loading the clinical record...'
                  : `${history?.length || 0} consultation${history?.length === 1 ? '' : 's'} on file`}
              </p>
            </div>
          </div>

          {historyError && (
            <div className="clinical-error-message">
              The clinical record could not be loaded: {historyError}{' '}
              <button type="button" onClick={refreshHistory}>
                Try again
              </button>
            </div>
          )}

          {!historyLoading && !historyError && patient && (
            <>
              {history?.length ? (
                <ul className="clinical-history-list">
                  {history.map((entry) => (
                    <li key={entry.id} className="clinical-history-item">
                      <div className="clinical-history-head">
                        <span className="clinical-history-date">
                          <CalendarDays size={14} />
                          {formatEncounterDate(entry.date || entry.consultationDate)}
                        </span>
                        <span className="clinical-history-clinician">
                          {entry.doctor || entry.doctorName || 'Clinician not recorded'}
                        </span>
                      </div>

                      <p className="clinical-history-diagnosis">{entry.diagnosis}</p>

                      {entry.complaint && (
                        <p className="clinical-history-detail">
                          <strong>Presenting complaint:</strong> {entry.complaint}
                        </p>
                      )}

                      {entry.treatment && (
                        <p className="clinical-history-detail">
                          <strong>Treatment:</strong> {entry.treatment}
                        </p>
                      )}

                      {entry.followUp && (
                        <p className="clinical-history-detail">
                          <strong>Follow-up:</strong> {entry.followUp}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="clinical-history-empty">
                  No consultation has been recorded for this patient yet. The first
                  one can be entered below.
                </p>
              )}
            </>
          )}
        </section>

        {!patient && (
          <div className="clinical-error-message">
            Select a patient from Patient Records to review or add a consultation.
          </div>
        )}

        <form className="clinical-form" onSubmit={handleSubmit}>
          <section className="clinical-card">
            <div className="clinical-card-heading">
              <div className="clinical-card-icon">
                <HeartPulse size={19} />
              </div>
              <div>
                <h2>Clinical assessment</h2>
                <p>Record the patient's current presentation.</p>
              </div>
            </div>

            <div className="clinical-fields">
              <div className="clinical-field clinical-field-full">
                <label htmlFor="complaint">Chief complaint</label>
                <textarea
                  id="complaint"
                  name="complaint"
                  rows="3"
                  placeholder="Describe the main reason for today's visit"
                  required
                />
              </div>

              <div className="clinical-field">
                <label htmlFor="symptoms">Symptoms</label>
                <textarea
                  id="symptoms"
                  name="symptoms"
                  rows="3"
                  placeholder="Enter observed or reported symptoms"
                />
              </div>

              <div className="clinical-field">
                <label htmlFor="diagnosis">Diagnosis</label>
                <textarea
                  id="diagnosis"
                  name="diagnosis"
                  rows="3"
                  placeholder="Enter clinical diagnosis"
                  required
                />
              </div>
            </div>
          </section>

          <section className="clinical-card">
            <div className="clinical-card-heading">
              <div className="clinical-card-icon">
                <Activity size={19} />
              </div>
              <div>
                <h2>Vital signs</h2>
                <p>Record the patient's basic clinical measurements.</p>
              </div>
            </div>

            <div className="clinical-fields clinical-vitals">
              <div className="clinical-field">
                <label htmlFor="bloodPressure">Blood pressure</label>
                <input
                  id="bloodPressure"
                  name="bloodPressure"
                  placeholder="e.g. 120/80 mmHg"
                />
              </div>

              <div className="clinical-field">
                <label htmlFor="temperature">Temperature</label>
                <input
                  id="temperature"
                  name="temperature"
                  placeholder="e.g. 36.8 °C"
                />
              </div>

              <div className="clinical-field">
                <label htmlFor="pulse">Pulse rate</label>
                <input
                  id="pulse"
                  name="pulse"
                  placeholder="e.g. 72 bpm"
                />
              </div>

              <div className="clinical-field">
                <label htmlFor="weight">Weight</label>
                <input
                  id="weight"
                  name="weight"
                  placeholder="e.g. 68 kg"
                />
              </div>
            </div>
          </section>

          <section className="clinical-card">
            <div className="clinical-card-heading">
              <div className="clinical-card-icon">
                <Pill size={19} />
              </div>
              <div>
                <h2>Treatment plan</h2>
                <p>Document treatment and medication instructions.</p>
              </div>
            </div>

            <div className="clinical-fields">
              <div className="clinical-field clinical-field-full">
                <label htmlFor="treatment">Treatment / medication</label>
                <textarea
                  id="treatment"
                  name="treatment"
                  rows="4"
                  placeholder="Enter medication, dosage and treatment instructions"
                />
              </div>

              <div className="clinical-field clinical-field-full">
                <label htmlFor="followUp">Follow-up recommendation</label>
                <textarea
                  id="followUp"
                  name="followUp"
                  rows="3"
                  placeholder="Enter recommended follow-up date or instructions"
                />
              </div>
            </div>
          </section>

          <section className="clinical-card">
            <div className="clinical-card-heading">
              <div className="clinical-card-icon">
                <FileText size={19} />
              </div>
              <div>
                <h2>Clinical notes</h2>
                <p>Add additional notes for the patient's record.</p>
              </div>
            </div>

            <div className="clinical-fields">
              <div className="clinical-field clinical-field-full">
                <label htmlFor="notes">Consultation notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows="5"
                  placeholder="Enter relevant clinical observations and notes"
                />
              </div>
            </div>
          </section>

          <div className="clinical-actions">
            <button
              type="button"
              className="clinical-cancel-button"
              onClick={onBack}
            >
              Cancel
            </button>

            <button type="submit" className="clinical-save-button" disabled={isSubmitting}>
              <Save size={17} />
              {isSubmitting ? 'Saving...' : saved ? 'Consultation saved' : 'Save consultation'}
            </button>
          </div>

          {submitError && (
            <div className="clinical-error-message">{submitError}</div>
          )}

          {saved && (
            <div className="clinical-success-message">
              <Stethoscope size={18} />
              Consultation saved successfully to the patient's clinical record.
            </div>
          )}
        </form>
      </div>
    </main>
  );
}

export default ClinicalCarePage;