import { ArrowRight, Play, Check } from 'lucide-react';

/**
 * The public landing page cannot show live clinic figures: every number would
 * have to come from a signed-in session, and inventing one for a marketing page
 * would be fabricating patient activity. This panel therefore describes what
 * the system actually does, and every item below is a feature that is really
 * implemented in the backend.
 */
const CAPABILITIES = [
  'One record per patient, with their full history in one place',
  'Appointments, consultations, prescriptions and results linked to that record',
  'Pharmacy stock that updates when a prescription is dispensed',
  'Role-based access for reception, clinical, pharmacy, laboratory and admin staff',
  'A patient portal so a patient can see their own record and results',
  'An audit trail recording who viewed or changed a record',
];

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
            HealthBridge is an electronic health record and health management
            system built for Nigerian primary healthcare centres. It keeps
            patient records, appointments, clinical notes, prescriptions,
            laboratory results and pharmacy stock connected to the same patient,
            so the information a clinician needs is already in front of them.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="hero-primary-button"
              onClick={onGetStarted}
            >
              Sign in
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
              See what it does
            </button>
          </div>

          <div className="hero-trust">
            <span>Built for Nigerian primary healthcare</span>
            <span className="hero-trust-dot"></span>
            <span>Role-based access</span>
            <span className="hero-trust-dot"></span>
            <span>Audit logged</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-dashboard-card">
            <div className="hero-dashboard-top">
              <div>
                <span className="hero-dashboard-label">ONE PATIENT RECORD</span>
                <h3>Everything connected</h3>
              </div>
            </div>

            <ul className="hero-capability-list">
              {CAPABILITIES.map((capability) => (
                <li key={capability}>
                  <Check size={15} />
                  <span>{capability}</span>
                </li>
              ))}
            </ul>

            <div className="hero-ai-card">
              <div>
                <strong>Insight summaries</strong>
                <p>
                  HealthBridge counts what is actually in the records — reviews
                  due, incomplete profiles, results needing attention — and
                  points a clinician at them. It does not make diagnoses.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
