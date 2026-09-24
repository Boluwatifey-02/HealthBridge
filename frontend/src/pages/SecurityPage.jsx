import {
  ArrowLeft,
  ShieldCheck,
  LockKeyhole,
  ClipboardCheck,
  Activity,
  MapPinned,
} from 'lucide-react';
import Brand from '../components/Brand';
import './SecurityPage.css';

const principles = [
  {
    icon: ShieldCheck,
    title: 'Role-based access',
    description:
      'Team access is organised around role-specific responsibilities so clinicians, administrators, pharmacists, and lab staff see only the information they need.',
  },
  {
    icon: LockKeyhole,
    title: 'Confidentiality',
    description:
      'Patient information is handled with privacy-first care to reduce unnecessary exposure and support trust in day-to-day clinical workflows.',
  },
  {
    icon: ClipboardCheck,
    title: 'Authentication and authorization',
    description:
      'Protected patient data is available only after staff sign in and access is validated against role permissions and operational needs.',
  },
  {
    icon: Activity,
    title: 'Auditability',
    description:
      'Key clinical and operational activities can be recorded to make care events, updates, and access patterns easier to review.',
  },
  {
    icon: MapPinned,
    title: 'Branch-aware access',
    description:
      'The system supports multiple healthcare centres while maintaining the correct branch-level visibility and information boundaries.',
  },
];

function SecurityPage({ onBack }) {
  return (
    <div className="security-page">
      <header className="security-header">
        <Brand dark />

        <button type="button" className="security-back" onClick={onBack}>
          <ArrowLeft size={17} />
          Back to Dashboard
        </button>
      </header>

      <main className="security-main">
        <section className="security-hero">
          <span className="security-eyebrow">Security & privacy</span>
          <h1>Designed for safe, confidential healthcare workflows.</h1>
          <p>
            HealthBridge is built for a real-world primary healthcare environment,
            where patient information must be protected, access must be role-aware,
            and clinical workflows must remain accountable.
          </p>
        </section>

        <section className="security-grid">
          {principles.map((principle) => {
            const Icon = principle.icon;

            return (
              <article className="security-card" key={principle.title}>
                <div className="security-icon">
                  <Icon size={21} strokeWidth={1.8} />
                </div>

                <h2>{principle.title}</h2>
                <p>{principle.description}</p>
              </article>
            );
          })}
        </section>

      </main>
    </div>
  );
}

export default SecurityPage;
