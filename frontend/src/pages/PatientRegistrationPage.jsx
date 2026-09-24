import { useState } from 'react';
import {
  ArrowLeft,
  UserRound,
  Phone,
  MapPin,
  HeartPulse,
  ShieldCheck,
  Save,
} from 'lucide-react';
import Brand from '../components/Brand';
import './PatientRegistrationPage.css';

function PatientRegistrationPage({ onBack, onPatientRegistered }) {
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const patient = {
      fullName: String(formData.get('fullName') || '').trim(),
      age: Number(formData.get('age')) || 0,
      gender: String(formData.get('gender') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      address: String(formData.get('address') || '').trim(),
      condition: String(formData.get('condition') || 'No condition recorded').trim(),
      allergies: String(formData.get('allergies') || 'None').trim(),
      bloodGroup: String(formData.get('bloodGroup') || '').trim(),
      status: 'Active',
    };

    if (!patient.fullName || !patient.age || !patient.gender || !patient.phone || !patient.address) {
      setSubmitError('Please complete all required fields before registering the patient.');
      return;
    }

    try {
      setSubmitError('');
      if (onPatientRegistered) {
        await onPatientRegistered(patient);
      }
    } catch (error) {
      setSubmitError(error.message || 'Failed to register patient. Please try again.');
    }
  };

  return (
    <main className="registration-page">
      <header className="registration-header">
        <Brand />

        <div className="registration-header-user">
          <span>Healthcare Staff</span>
          <div className="registration-user-avatar">A</div>
        </div>
      </header>

      <div className="registration-container">
        <button
          type="button"
          className="registration-back-button"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          Back to patient records
        </button>

        <section className="registration-heading">
          <span className="registration-label">HEALTHBRIDGE RECORDS</span>
          <h1>Register a patient.</h1>
          <p>
            Create a secure digital patient record for healthcare teams to
            access and manage across connected workflows.
          </p>
        </section>

        <form className="registration-form" onSubmit={handleSubmit}>
          <section className="registration-card">
            <div className="registration-card-heading">
              <div className="registration-card-icon">
                <UserRound size={18} />
              </div>

              <div>
                <h2>Personal information</h2>
                <p>Basic information used to identify the patient.</p>
              </div>
            </div>

            <div className="registration-fields">
              <div className="registration-field registration-field-wide">
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Enter patient's full name"
                  required
                />
              </div>

              <div className="registration-field">
                <label htmlFor="age">Age</label>
                <input
                  id="age"
                  name="age"
                  type="number"
                  min="0"
                  max="120"
                  placeholder="e.g. 34"
                  required
                />
              </div>

              <div className="registration-field">
                <label htmlFor="gender">Gender</label>
                <select id="gender" name="gender" required defaultValue="">
                  <option value="" disabled>
                    Select gender
                  </option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="registration-field">
                <label htmlFor="bloodGroup">Blood group</label>
                <select
                  id="bloodGroup"
                  name="bloodGroup"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select blood group
                  </option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>
          </section>

          <section className="registration-card">
            <div className="registration-card-heading">
              <div className="registration-card-icon">
                <Phone size={18} />
              </div>

              <div>
                <h2>Contact information</h2>
                <p>How the healthcare centre can reach the patient.</p>
              </div>
            </div>

            <div className="registration-fields">
              <div className="registration-field">
                <label htmlFor="phone">Phone number</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+234 800 000 0000"
                  required
                />
              </div>

              <div className="registration-field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="patient@example.com"
                />
              </div>

              <div className="registration-field registration-field-wide">
                <label htmlFor="address">Residential address</label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  placeholder="Enter patient's residential address"
                  required
                />
              </div>
            </div>
          </section>

          <section className="registration-card">
            <div className="registration-card-heading">
              <div className="registration-card-icon">
                <HeartPulse size={18} />
              </div>

              <div>
                <h2>Medical information</h2>
                <p>Initial clinical information for the patient's record.</p>
              </div>
            </div>

            <div className="registration-fields">
              <div className="registration-field registration-field-wide">
                <label htmlFor="condition">
                  Presenting condition / complaint
                </label>
                <input
                  id="condition"
                  name="condition"
                  type="text"
                  placeholder="e.g. Hypertension, malaria, headache..."
                />
              </div>

              <div className="registration-field registration-field-wide">
                <label htmlFor="allergies">Known allergies</label>
                <input
                  id="allergies"
                  name="allergies"
                  type="text"
                  placeholder="e.g. Penicillin, dust, none known..."
                />
              </div>

              <div className="registration-field registration-field-wide">
                <label htmlFor="notes">Clinical notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows="5"
                  placeholder="Add any relevant initial observations or notes..."
                />
              </div>
            </div>
          </section>

          <section className="registration-security">
            <ShieldCheck size={19} />

            <div>
              <strong>Secure patient information</strong>
              <p>
                Patient information is intended for authorized healthcare
                staff and will be protected through role-based access.
              </p>
            </div>
          </section>

          {submitError && (
            <div
              role="alert"
              style={{
                marginTop: '0.75rem',
                color: '#9f1d2d',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              {submitError}
            </div>
          )}

          <div className="registration-actions">
            <button
              type="button"
              className="registration-cancel"
              onClick={onBack}
            >
              Cancel
            </button>

            <button type="submit" className="registration-submit">
              <Save size={17} />
              Register patient
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default PatientRegistrationPage;