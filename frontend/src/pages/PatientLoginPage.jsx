import { useState } from 'react';
import { UserRound, Lock } from 'lucide-react';
import Brand from '../components/Brand';
import './PatientLoginPage.css';

/**
 * Patient portal sign-in.
 *
 * A patient signs in with the email address the clinic has on their record. The
 * session is separate from a staff session and is rejected by every staff route,
 * so a patient can see their own record and nothing else.
 */
function PatientLoginPage({ onLogin, onForgotPassword, onRegisterClick, error }) {
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      await onLogin(event);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="patient-login-page">
      <header className="patient-login-header">
        <Brand />
        <a className="patient-login-staff-link" href="/login">Staff sign in</a>
      </header>

      <main className="patient-login-main">
        <section className="patient-login-card">
          <div className="patient-login-icon">
            <UserRound size={22} />
          </div>

          <h1>Patient portal</h1>
          <p className="patient-login-subtitle">
            Sign in to access your appointments, prescriptions and test results.
          </p>

          <form className="patient-login-form" onSubmit={handleSubmit}>
            <label>
              Email address
              <input
                type="email"
                name="email"
                autoComplete="username"
                placeholder="you@example.com"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Your password"
                required
              />
            </label>

            {error && (
              <p className="patient-login-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="patient-login-submit" disabled={busy}>
              <Lock size={16} />
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <button type="button" className="patient-login-forgot" onClick={onForgotPassword}>
            Forgotten your password?
          </button>

          <button type="button" className="patient-login-register" onClick={onRegisterClick}>
            Create an account
          </button>

          <p className="patient-login-note">
            No portal access yet? Register to create your account.
          </p>
        </section>
      </main>
    </div>
  );
}

export default PatientLoginPage;
