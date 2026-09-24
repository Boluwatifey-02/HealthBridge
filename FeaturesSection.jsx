import {
  Users,
  CalendarDays,
  Pill,
  FlaskConical,
  ShieldCheck,
  LayoutDashboard,
} from 'lucide-react';

const features = [
  {
    icon: Users,
    number: '01',
    title: 'Patient Records',
    description:
      'Create, access, and manage digital patient records from one connected system.',
  },
  {
    icon: CalendarDays,
    number: '02',
    title: 'Appointments',
    description:
      'Organise appointments and follow-ups so healthcare teams can stay on top of patient care.',
  },
  {
    icon: LayoutDashboard,
    number: '03',
    title: 'Unified Dashboard',
    description:
      'Give administrators and healthcare teams a clear view of activity across the centre.',
  },
  {
    icon: Pill,
    number: '04',
    title: 'Pharmacy Management',
    description:
      'Connect prescriptions with pharmacy workflows and keep medication inventory organised.',
  },
  {
    icon: FlaskConical,
    number: '05',
    title: 'Laboratory Workflow',
    description:
      'Manage laboratory requests and results as part of the patient care journey.',
  },
  {
    icon: ShieldCheck,
    number: '06',
    title: 'Security & Privacy',
    description:
      'Protect sensitive health information with role-based access and privacy-focused design across every clinical workflow.',
  },
];

function FeaturesSection() {
  return (
    <section className="features-section" id="features">
      <div className="features-container">
        <div className="features-heading">
          <div>
            <span className="section-label">CORE FEATURES</span>

            <h2>
              One connected system for
              <span> better healthcare delivery.</span>
            </h2>
          </div>

          <p>
            HealthBridge brings the essential workflows of a primary healthcare
            centre together in one simple, connected platform.
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                className="feature-card"
                key={feature.number}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (feature.title === 'Patient Records') {
                    window.location.href = '/patients';
                  }
                  if (feature.title === 'Appointments') {
                    window.location.href = '/appointments';
                  }
                  if (feature.title === 'Unified Dashboard') {
                    window.location.href = '/dashboard';
                  }
                  if (feature.title === 'Pharmacy Management') {
                    window.location.href = '/pharmacy';
                  }
                  if (feature.title === 'Laboratory Workflow') {
                    window.location.href = '/laboratory';
                  }
                  if (feature.title === 'Security & Privacy') {
                    window.location.href = '/security';
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (feature.title === 'Patient Records') {
                      window.location.href = '/patients';
                    }
                    if (feature.title === 'Appointments') {
                      window.location.href = '/appointments';
                    }
                    if (feature.title === 'Unified Dashboard') {
                      window.location.href = '/dashboard';
                    }
                    if (feature.title === 'Pharmacy Management') {
                      window.location.href = '/pharmacy';
                    }
                    if (feature.title === 'Laboratory Workflow') {
                      window.location.href = '/laboratory';
                    }
                    if (feature.title === 'Security & Privacy') {
                      window.location.href = '/security';
                    }
                  }
                }}
              >
                <div className="feature-card-top">
                  <span className="feature-number">{feature.number}</span>

                  <div className="feature-icon">
                    <Icon size={21} strokeWidth={1.7} />
                  </div>
                </div>

                <h3>{feature.title}</h3>

                <p>{feature.description}</p>

                <span className="feature-line"></span>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;