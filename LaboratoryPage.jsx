import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  FlaskConical,
  Search,
  Plus,
  Clock3,
  CheckCircle2,
} from 'lucide-react';
import Brand from '../components/Brand';
import api from '../services/api';
import './LaboratoryPage.css';

function LaboratoryPage({ onBack }) {
  const [search, setSearch] = useState('');
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState([]);

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

  const addRequest = async () => {
    const patient = patients[0];
    if (!patient) {
      setError('No real patient records are available to create a test request.');
      return;
    }

    const payload = {
      patientId: patient.id,
      testName: 'General Laboratory Test',
      status: 'Pending',
      priority: 'Routine',
      notes: 'Created during workflow test',
    };

    try {
      setError('');
      const created = await api.createLabRequest(payload);
      setRequests((current) => [created, ...current]);
    } catch (createError) {
      console.error('Unable to add lab request via backend:', createError);
      setError(createError.message || 'Unable to create a laboratory request.');
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

          <button type="button" className="laboratory-add" onClick={addRequest}>
            <Plus size={18} />
            New Request
          </button>
        </section>

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