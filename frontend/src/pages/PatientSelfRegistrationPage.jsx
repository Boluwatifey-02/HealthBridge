import { useState } from 'react';
import {
  ArrowLeft,
  UserRound,
  HeartPulse,
  ShieldCheck,
  Save,
} from 'lucide-react';
import Brand from '../components/Brand';
import api from '../services/api';
import './PatientRegistrationPage.css';

function PatientSelfRegistrationPage({ onBack, onRegistered }) {
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    const formData = new FormData(event.currentTarget);
    const payload = {
      fullName: String(formData.get('fullName') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      password: String(formData.get('password') || ''),
      confirmPassword: String(formData.get('confirmPassword') || ''),
      phone: String(formData.get('phone') || '').trim(),
      address: String(formData.get('address') || '').trim(),
      age: Number(formData.get('age')) || undefined,
      gender: String(formData.get('gender') || '').trim(),
      bloodGroup: String(formData.get('bloodGroup') || '').trim(),
      genotype: String(formData.get('genotype') || '').trim(),
      allergies: String(formData.get('allergies') || 'None known').trim(),
      condition: String(formData.get('condition') || 'Not recorded').trim(),
      occupation: String(formData.get('occupation') || '').trim(),
      emergencyContact: String(formData.get('emergencyContact') || '').trim(),
      nationalId: String(formData.get('nationalId') || '').trim(),
      medicalHistory: String(formData.get('medicalHistory') || '').trim(),
    };

    if (!payload.fullName || !payload.email || !payload.password || !payload.phone || !payload.address) {
      setSubmitError('Please complete all required fields before creating your account.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await api.patientRegister(payload);
      if (onRegistered) {
        onRegistered(response);
      }
    } catch (error) {
      setSubmitError(error.message || 'Account creation failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="registration-page">
      <header className="registration-header">
        <Brand />
      </header>

      <div className="registration-container">
        <button
          type="button"
          className="registration-back-button"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          Back to sign in
        </button>

        <section className="registration-heading">
          <span className="registration-label">CREATE PATIENT ACCOUNT</span>
          <h1>Register for the patient portal.</h1>
          <p>
            Create a secure account to access your appointments, prescriptions,
            and test results.
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
                <p>Basic information used to identify you.</p>
              </div>
            </div>

            <div className="registration-fields">
              <div className="registration-field registration-field-wide">
                <label htmlFor="fullName">Full name *</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="registration-field">
                <label htmlFor="email">Email address *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="registration-field">
                <label htmlFor="phone">Phone number *</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+234 800 000 0000"
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
                />
              </div>

              <div className="registration-field">
                <label htmlFor="gender">Gender</label>
                <select id="gender" name="gender" defaultValue="">
                  <option value="">Select gender</option>
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
                  <option value="">Select blood group</option>
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

              <div className="registration-field">
                <label htmlFor="genotype">Genotype</label>
                <select
                  id="genotype"
                  name="genotype"
                  defaultValue=""
                >
                  <option value="">Select genotype</option>
                  <option value="AA">AA</option>
                  <option value="AS">AS</option>
                  <option value="SS">SS</option>
                  <option value="AC">AC</option>
                  <option value="SC">SC</option>
                  <option value="CC">CC</option>
                </select>
              </div>

              <div className="registration-field registration-field-wide">
                <label htmlFor="address">Residential address *</label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  placeholder="Enter your residential address"
                  required
                />
              </div>

              <div className="registration-field">
                <label htmlFor="occupation">Occupation</label>
                <input
                  id="occupation"
                  name="occupation"
                  type="text"
                  placeholder="e.g. Teacher, Engineer"
                />
              </div>

              <div className="registration-field">
                <label htmlFor="emergencyContact">Emergency contact</label>
                <input
                  id="emergencyContact"
                  name="emergencyContact"
                  type="text"
                  placeholder="Name and phone number"
                />
              </div>

              <div className="registration-field">
                <label htmlFor="nationalId">National ID</label>
                <input
                  id="nationalId"
                  name="nationalId"
                  type="text"
                  placeholder="Your national identity number"
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
                <p>Initial clinical information for your record.</p>
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
                <label htmlFor="medicalHistory">Medical history</label>
                <textarea
                  id="medicalHistory"
                  name="medicalHistory"
                  rows="5"
                  placeholder="Any relevant previous conditions, surgeries, or treatments..."
                />
              </div>
            </div>
          </section>

          <section className="registration-card">
            <div className="registration-card-heading">
              <div className="registration-card-icon">
                <ShieldCheck size={18} />
              </div>

              <div>
                <h2>Account security</h2>
                <p>Choose a secure password for your patient portal.</p>
              </div>
            </div>

            <div className="registration-fields">
              <div className="registration-field registration-field-wide">
                <label htmlFor="password">Password *</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="At least 8 characters with a letter and a number"
                  required
                  minLength={8}
                />
              </div>

              <div className="registration-field registration-field-wide">
                <label htmlFor="confirmPassword">Confirm password *</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  required
                  minLength={8}
                />
              </div>
            </div>
          </section>

          <section className="registration-security">
            <ShieldCheck size={19} />

            <div>
              <strong>Secure patient information</strong>
              <p>
                Your information is protected with secure, role-based access.
                Only authorised healthcare staff can view your clinical records.
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

            <button type="submit" className="registration-submit" disabled={isSubmitting}>
              <Save size={17} />
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default PatientSelfRegistrationPage;
