import {
  ArrowLeft,
  ShieldCheck,
  LockKeyhole,
  ClipboardCheck,
  Activity,
  KeyRound,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import Brand from '../components/Brand';
import './SecurityPage.css';

/**
 * The controls below are all implemented in this codebase, and each one can be
 * checked in the running system. The page previously claimed AES-256 encryption
 * at rest, multi-factor authentication and GDPR/HIPAA/NIST compliance, none of
 * which this system does. Claiming certifications a system has not been audited
 * for is worse than saying nothing, so the limitations are stated explicitly
 * alongside the real controls.
 */
const implemented = [
  {
    icon: KeyRound,
    title: 'Passwords are hashed, never stored',
    detail:
      'Passwords are hashed with bcrypt at cost 10. A database copy therefore contains no readable password, and a leaked hash cannot be used to sign in without the original password.',
  },
  {
    icon: LockKeyhole,
    title: 'Sessions are signed and expire',
    detail:
      'Sign-in returns a signed token that expires after a set period. A staff session and a patient session are issued separately, and each is rejected by the other set of routes.',
  },
  {
    icon: ClipboardCheck,
    title: 'Access is enforced per role',
    detail:
      'Each route requires a specific permission, and a permission is granted only to the roles that need it in practice. A laboratory technician cannot register a patient, and a pharmacist cannot write a prescription.',
  },
  {
    icon: ShieldCheck,
    title: 'A patient sees only their own record',
    detail:
      'A patient portal session carries that patient id in a signed token. The record is resolved from the token rather than from anything the browser sends, so one patient cannot request another patient\'s data.',
  },
  {
    icon: Activity,
    title: 'Every change is recorded',
    detail:
      'Registrations, edits, bookings, dispensing, laboratory results and account changes are written to an audit trail naming the user, the action and the time. An administrator can read it.',
  },
  {
    icon: LockKeyhole,
    title: 'Sign-in attempts are rate limited',
    detail:
      'Login, password reset and patient portal routes have stricter request limits than ordinary reads, so passwords cannot be guessed in bulk.',
  },
];

/**
 * Stated plainly so nobody relies on a control that is not there.
 */
const notImplemented = [
  'Multi-factor authentication. Staff sign in with a password only.',
  'Encryption of records beyond the database connection. Fields are stored as ordinary text, so anyone with database access can read them.',
  'Automatic logoff after a period of inactivity. A session ends when its token expires or the user signs out.',
  'Formal compliance certification. HealthBridge has not been audited against HIPAA, GDPR or NIST, and does not claim to be.',
  'Data encryption at rest under application control. That depends entirely on how the database provider stores it.',
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
          <span className="security-eyebrow">Security &amp; privacy</span>
          <h1>What this system actually does to protect patient data.</h1>
          <p>
            HealthBridge handles protected health information, so this page lists
            the controls that are genuinely implemented — and, just as
            importantly, the ones that are not. Anything claimed here can be
            checked in the running system.
          </p>
        </section>

        <section className="security-grid">
          {implemented.map((control) => {
            const Icon = control.icon;

            return (
              <article className="security-card" key={control.title}>
                <div className="security-icon">
                  <Icon size={21} strokeWidth={1.8} />
                </div>

                <h2>{control.title}</h2>
                <p>{control.detail}</p>
              </article>
            );
          })}
        </section>

        <section className="security-limits">
          <div className="security-limits-heading">
            <AlertTriangle size={20} />
            <div>
              <h2>Not currently implemented</h2>
              <p>
                These are genuine gaps, listed so nobody assumes a protection
                that is not in place.
              </p>
            </div>
          </div>

          <ul>
            {notImplemented.map((limitation) => (
              <li key={limitation}>
                <X size={15} />
                <span>{limitation}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="security-limits security-limits-positive">
          <div className="security-limits-heading">
            <Check size={20} />
            <div>
              <h2>Practising with this data</h2>
              <p>
                The demonstration dataset is fictional: every patient name
                begins with "Demo" so a sample record can never be mistaken for
                a real person. Do not enter real patient information into a
                demonstration deployment.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default SecurityPage;
