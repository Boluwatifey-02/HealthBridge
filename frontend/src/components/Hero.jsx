import { ArrowRight, Play } from 'lucide-react';

function Hero({ onGetStarted }) {
  return (
    <section className="hero-section" id="home">
      <div className="hero-container">
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-line"></span>
            <span>SMARTER HEALTHCARE. BETTER OUTCOMES.</span>
          </div>

          <h1>
            Connecting healthcare
            <span> from record to recovery.</span>
          </h1>

          <p className="hero-description">
            HealthBridge is an AI-powered electronic health record and health
            management system designed to help Nigerian primary healthcare
            centres deliver more connected, efficient, and patient-centred care.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="hero-primary-button"
              onClick={onGetStarted}
            >
              Get Started
              <ArrowRight size={17} />
            </button>

            <button
  type="button"
  className="hero-secondary-button"
  onClick={() => {
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
  }}
>
              <span className="hero-play-icon">
                <Play size={13} fill="currentColor" />
              </span>
              Explore HealthBridge
            </button>
          </div>

          <div className="hero-trust">
            <span>Built for Nigerian primary healthcare</span>
            <span className="hero-trust-dot"></span>
            <span>AI-enabled</span>
            <span className="hero-trust-dot"></span>
            <span>Secure</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-dashboard-card">
            <div className="hero-dashboard-top">
              <div>
                <span className="hero-dashboard-label">
                  HEALTHBRIDGE OVERVIEW
                </span>
                <h3>Healthcare at a glance</h3>
              </div>

              <span className="hero-live">
                <span></span>
                Live
              </span>
            </div>

            <div className="hero-dashboard-stats">
              <div
            className="hero-stats-card"
            role="button"
            tabIndex={0}
            onClick={() => {
            window.location.href = '/patients';
            }}
            >
                <span className="hero-stat-icon">+</span>
                <strong>100</strong>
                <small>Registered Patients</small>
              </div>

              <div
              className="hero-stats-card"
              role="button"
              tabIndex={0}
              onClick={() => {
              window.location.href = '/appointments';
             }}
              >
                <span className="hero-stat-icon">◷</span>
                <strong>50</strong>
                <small>Appointments</small>
              </div>

              <div
              className="hero-stats-card"
              role="button"
              tabIndex={0}
              onClick={() => {
              window.location.href = '/ai-insights';
               }}
               >
                <span className="hero-stat-icon">✓</span>
                <strong>94%</strong>
                <small>Care Follow-ups</small>
              </div>
            </div>

            <div className="hero-chart-card">
              <div className="hero-chart-heading">
                <div>
                  <span>Patient activity</span>
                  <strong>This month</strong>
                </div>

                <span className="hero-chart-growth">+18.4%</span>
              </div>

              <div className="hero-chart">
                <span className="chart-bar bar-one"></span>
                <span className="chart-bar bar-two"></span>
                <span className="chart-bar bar-three"></span>
                <span className="chart-bar bar-four"></span>
                <span className="chart-bar bar-five"></span>
                <span className="chart-bar bar-six"></span>
                <span className="chart-bar bar-seven"></span>
              </div>

              <div className="hero-chart-days">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>

            <div
            className="hero-ai-card"
            role="button"
            tabIndex={0}
            onClick={() => {
            window.location.href = '/ai-insights';
            }}
            >
              <div className="hero-ai-icon">✦</div>

              <div>
                <strong>AI Health Insight</strong>
                <p>
                  Follow-up recommended for 12 patients based on recent
                  records.
                </p>
              </div>

              <ArrowRight size={16} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;