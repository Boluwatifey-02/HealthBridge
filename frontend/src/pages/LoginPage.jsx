import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import Brand from '../components/Brand';
import './LoginPage.css';

function LoginPage({ onLogin, onPatientLoginClick, onForgotPassword, error }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <main className="login-page">
      <div className="login-container">

        <div className="login-brand">
          <Brand />
        </div>

        <div className="login-header">
          <span className="login-label">HEALTHCARE ACCESS</span>

          <h1>Welcome back.</h1>

          <p>
            Sign in to access your HealthBridge healthcare management
            workspace.
          </p>
        </div>

        <form className="login-form" onSubmit={onLogin}>

          <div className="form-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <div className="password-label">
              <label htmlFor="password">Password</label>
              <button type="button" onClick={onForgotPassword}>
                Forgot password?
              </button>
            </div>

            <div className="password-input">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
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

          <button type="submit" className="login-submit">
            Sign in
            <ArrowRight size={17} />
          </button>

          <div className="login-patient-link">
            <span>Patient?</span>
            <button type="button" onClick={onPatientLoginClick}>
              Open the patient portal
            </button>
          </div>

        </form>

        <div className="login-security">
          <ShieldCheck size={17} />
          <span>
            Your healthcare information is protected with secure,
            role-based access.
          </span>
        </div>

      </div>
    </main>
  );
}

export default LoginPage;