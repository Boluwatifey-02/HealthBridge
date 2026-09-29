import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  FlaskConical,
  Search,
  Plus,
  Clock3,
  CheckCircle2,
  LogOut,
} from 'lucide-react';
import Brand from '../components/Brand';
import api from '../services/api';
import './LaboratoryPage.css';

function LaboratoryPage({ onBack, onLogout }) {
  const [search, setSearch] = useState('');
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const loadRequests = async () => {
      try {
        setIsLoading(true);
        setError('');

        const [labData, patientData] = await Promise.all([
          api.getLabRequests(),
          api.getPatients(),
        ]);

        setRequests(Array.isArray(labData) ? labData : []);
        setPatients(Array.isArray(patientData) ? patientData : []);
      } catch (loadError) {
        console.error('Unable to fetch lab requests:', loadError);
        setRequests([]);
        setPatients([]);
        setError(loadError.message || 'Unable to load laboratory requests.');
      } finally {
        setIsLoading(false);
      }
    };

    loadRequests();
  }, []);

  const filteredRequests = requests.filter((request) =>
    `${request.patient} ${request.test} ${request.id}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const addRequest = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const patientId = String(formData.get('patientId') || '').trim();
    const testName = String(formData.get('testName') || '').trim();
    const priority = String(formData.get('priority') || 'Routine').trim();
    const notes = String(formData.get('notes') || '').trim();

    if (!patientId || !testName) {
      setFormError('Select a patient and enter the test required.');
      return;
    }

    try {
      setFormError('');
      setIsSaving(true);

      const created = await api.createLabRequest({
        patientId,
        testName,
        status: 'Pending',
        priority,
        notes,
      });

      setRequests((current) => [created, ...current]);
      setIsFormOpen(false);
      form.reset();
    } catch (createError) {
      console.error('Unable to add lab request via backend:', createError);
      setFormError(createError.message || 'Unable to create a laboratory request.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="laboratory-page">
      <header className="laboratory-header">
        <Brand dark />

        <button type="button" className="laboratory-back" onClick={onBack}>
          <ArrowLeft size={17} />
          Back to Dashboard
        </button>

        {onLogout && (
          <button type="button" className="laboratory-back" onClick={onLogout}>
            <LogOut size={17} />
            Log out
          </button>
        )}
      </header>

      <main className="laboratory-main">
        <section className="laboratory-hero">
          <div>
            <span className="laboratory-eyebrow">
              <FlaskConical size={16} />
              Laboratory Services
            </span>

            <h1>Laboratory Requests</h1>
            <p>
              Manage laboratory investigations, track test requests and
              monitor results from one place.
            </p>
          </div>

          <button
            type="button"
            className="laboratory-add"
            onClick={() => {
              setIsFormOpen((open) => !open);
              setFormError('');
            }}
          >
            <Plus size={18} />
            New Request
          </button>
        </section>

        {isFormOpen && (
          <form className="laboratory-form" onSubmit={addRequest}>
            <h2>Order a laboratory investigation</h2>

            <div className="laboratory-form-grid">
              <label>
                <span>Patient</span>
                <select name="patientId" required defaultValue="">
                  <option value="" disabled>
                    Select a patient
                  </option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} ({patient.id})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Test required</span>
                <input type="text" name="testName" required placeholder="e.g. Full Blood Count" />
              </label>

              <label>
                <span>Priority</span>
                <select name="priority" defaultValue="Routine">
                  <option value="Routine">Routine</option>
                  <option value="Urgent">Urgent</option>
                  <option value="STAT">STAT</option>
                </select>
              </label>

              <label className="laboratory-form-full">
                <span>Clinical notes</span>
                <input type="text" name="notes" placeholder="Optional notes for laboratory staff" />
              </label>
            </div>

            {formError && <div className="laboratory-form-error">{formError}</div>}

            <div className="laboratory-form-actions">
              <button
                type="button"
                className="laboratory-form-cancel"
                onClick={() => setIsFormOpen(false)}
              >
                Cancel
              </button>

              <button type="submit" className="laboratory-form-save" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save request'}
              </button>
            </div>
          </form>
        )}

        <section className="laboratory-stats">
          <div className="laboratory-stat">
            <FlaskConical size={22} />
            <div>
              <strong>{requests.length}</strong>
              <span>Total Requests</span>
            </div>
          </div>

          <div className="laboratory-stat">
            <Clock3 size={22} />
            <div>
              <strong>
                {requests.filter((item) => item.status === 'Pending').length}
              </strong>
              <span>Pending</span>
            </div>
          </div>

          <div className="laboratory-stat">
            <CheckCircle2 size={22} />
            <div>
              <strong>
                {requests.filter((item) => item.status === 'Completed').length}
              </strong>
              <span>Completed</span>
            </div>
          </div>
        </section>

        <section className="laboratory-panel">
          <div className="laboratory-panel-header">
            <div>
              <h2>Test Requests</h2>
              <p>Recent laboratory investigations</p>
            </div>

            <div className="laboratory-search">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search patient or test..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="laboratory-empty-state">{error}</div>
          )}

          {isLoading && !error && (
            <div className="laboratory-empty-state">Loading laboratory requests...</div>
          )}

          {!isLoading && !error && (
            <div className="laboratory-table">
              <div className="laboratory-table-head">
                <span>Request ID</span>
                <span>Patient</span>
                <span>Test</span>
                <span>Status</span>
                <span>Date</span>
              </div>

              {filteredRequests.map((request) => (
                <div className="laboratory-table-row" key={request.id}>
                  <strong>{request.id}</strong>
                  <span>{request.patient}</span>
                  <span>{request.test}</span>
                  <span
                    className={
                      request.status === 'Completed'
                        ? 'status completed'
                        : 'status pending'
                    }
                  >
                    {request.status}
                  </span>
                  <span>{request.date}</span>
                </div>
              ))}

              {!filteredRequests.length && (
                <div className="laboratory-empty-state">No laboratory requests match your search.</div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default LaboratoryPage;