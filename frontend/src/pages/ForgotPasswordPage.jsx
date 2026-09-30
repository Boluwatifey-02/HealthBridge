import { useState } from 'react';
import { ArrowRight, ArrowLeft, ShieldCheck, MailCheck } from 'lucide-react';
import Brand from '../components/Brand';
import api from '../services/api';
import './LoginPage.css';

function ForgotPasswordPage({ onBackToLogin }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter the email address registered to your account.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await api.forgotPassword(trimmedEmail);
      setMessage(response.message);
    } catch (submitError) {
      setError(submitError.message || 'Unable to process the request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-container">

        <div className="login-brand">
          <Brand />
        </div>

        <div className="login-header">
          <span className="login-label">PASSWORD RECOVERY</span>

          <h1>Reset your password.</h1>

          <p>
            Enter the email address registered to your HealthBridge account and
            we will send you a secure link to choose a new password.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>

          <div className="form-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {error && (
            <div
              role="alert"
              style={{
                marginTop: '0.75rem',
                color: '#9f1d2d',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              role="status"
              style={{
                marginTop: '0.75rem',
                color: '#0f766e',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              <MailCheck size={16} style={{ verticalAlign: '-3px', marginRight: '6px' }} />
              {message}
            </div>
          )}

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending link...' : 'Send reset link'}
            <ArrowRight size={17} />
          </button>

          <button
            type="button"
            className="login-submit"
            onClick={onBackToLogin}
            style={{ marginTop: '0.6rem', background: 'transparent', color: '#0f766e' }}
          >
            <ArrowLeft size={17} />
            Back to sign in
          </button>

        </form>

        <div className="login-security">
          <ShieldCheck size={17} />
          <span>
            Reset links expire after 30 minutes and can only be used once.
          </span>
        </div>

      </div>
    </main>
  );
}

export default ForgotPasswordPage;
