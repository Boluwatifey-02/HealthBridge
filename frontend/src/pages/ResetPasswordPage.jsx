import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import Brand from '../components/Brand';
import api from '../services/api';
import './LoginPage.css';

function ResetPasswordPage({ token, onBackToLogin, onResetComplete }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('checking');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkToken = async () => {
      if (!token) {
        setStatus('invalid');
        setError('This reset link is missing its token. Please request a new one.');
        return;
      }

      try {
        await api.verifyResetToken(token);
        if (!cancelled) setStatus('valid');
      } catch (tokenError) {
        if (cancelled) return;
        setStatus('invalid');
        setError(tokenError.message || 'This reset link is invalid or has expired.');
      }
    };

    checkToken();

    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await api.resetPassword({ token, password, confirmPassword });
      setStatus('done');
      onResetComplete();
    } catch (submitError) {
      setError(submitError.message || 'Unable to update your password. Please try again.');
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
          <span className="login-label">CHOOSE A NEW PASSWORD</span>

          <h1>Set your new password.</h1>

          <p>
            Pick a password you have not used before. It needs at least eight
            characters and must include both a letter and a number.
          </p>
        </div>

        {status === 'checking' && (
          <div className="login-form">
            <p style={{ color: '#52606d' }}>Checking your reset link...</p>
          </div>
        )}

        {status === 'invalid' && (
          <div className="login-form">
            <div
              role="alert"
              style={{ color: '#9f1d2d', fontWeight: 600, marginBottom: '1rem' }}
            >
              {error}
            </div>
            <button type="button" className="login-submit" onClick={onBackToLogin}>
              Request a new link
              <ArrowRight size={17} />
            </button>
          </div>
        )}

        {status === 'valid' && (
          <form className="login-form" onSubmit={handleSubmit}>

            <div className="form-field">
              <label htmlFor="new-password">New password</label>
              <div className="password-input">
                <input
                  id="new-password"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="confirm-password">Confirm new password</label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
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

            <button type="submit" className="login-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update password'}
              <ArrowRight size={17} />
            </button>

          </form>
        )}

        {status === 'done' && (
          <div className="login-form">
            <div style={{ color: '#0f766e', fontWeight: 600, marginBottom: '1rem' }}>
              Your password has been updated.
            </div>
            <button type="button" className="login-submit" onClick={onBackToLogin}>
              Sign in with your new password
              <ArrowRight size={17} />
            </button>
          </div>
        )}

        <div className="login-security">
          <ShieldCheck size={17} />
          <span>
            Your new password is stored as a bcrypt hash and is never sent anywhere.
          </span>
        </div>

      </div>
    </main>
  );
}

export default ResetPasswordPage;
