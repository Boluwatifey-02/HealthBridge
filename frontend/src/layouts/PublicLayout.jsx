import PublicNav from '../components/PublicNav';
import Brand from '../components/Brand';
import {
  Mail,
  Phone,
  MapPin,
  ArrowUpRight,
} from 'lucide-react';
import { useState } from 'react';

/**
 * Contact details come from the build environment. The footer previously printed
 * a phone number and an address that were never verified, presented as if they
 * were real. With nothing configured the footer points at the contact form
 * instead of showing a number nobody answers.
 */
const CONTACT_EMAIL = String(import.meta.env.VITE_CONTACT_EMAIL || '').trim();
const CONTACT_PHONE = String(import.meta.env.VITE_CONTACT_PHONE || '').trim();
const CONTACT_ADDRESS = String(import.meta.env.VITE_CONTACT_ADDRESS || '').trim();

function PublicLayout({ children, onLoginClick, onPatientLoginClick }) {
  const [page, setPage] = useState('Home');

  const handleLogin = () => {
    if (onLoginClick) {
      onLoginClick();
      return;
    }

    window.location.href = '/login';
  };

  const handlePatientLogin = () => {
    if (onPatientLoginClick) {
      onPatientLoginClick();
      return;
    }

    window.location.href = '/patient-portal';
  };

  const handleSecurityNavigation = () => {
    if (onLoginClick) {
      onLoginClick();
      return;
    }

    window.location.href = '/security';
  };

  const handleNavigation = (section) => {
    setPage(section);

    if (section === 'Privacy' || section === 'Terms') {
      handleSecurityNavigation();
      return;
    }

    const idMap = {
      Home: 'home',
      About: 'about',
      Features: 'features',
      Services: 'services',
      'AI Features': 'ai-features',
      Contact: 'contact',
    };

    const targetId = idMap[section];

    if (targetId) {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="public-layout">
      <PublicNav
        page={page}
        setPage={handleNavigation}
        onLogin={handleLogin}
        onPatientLogin={handlePatientLogin}
      />

      <main>{children}</main>

      <footer className="public-footer">
        <div className="public-footer-container">
          <div className="public-footer-main">
            <div className="public-footer-brand">
              <Brand dark />

              <p>
                Bridging the gap between healthcare and technology in
                Nigerian primary health centres.
              </p>
            </div>

            <div className="public-footer-column">
              <h4>Quick Links</h4>

              <button onClick={() => handleNavigation('Home')}>
                Home
              </button>

              <button onClick={() => handleNavigation('About')}>
                About
              </button>

              <button onClick={() => handleNavigation('Features')}>
                Features
              </button>

              <button onClick={() => handleNavigation('Services')}>
                    Services
              </button>

              <button onClick={() => handleNavigation('AI Features')}>
                AI Features
              </button>

              <button onClick={() => handleNavigation('Contact')}>
                Contact
              </button>
            </div>

            <div className="public-footer-column">
              <h4>Contact</h4>

              {CONTACT_EMAIL ? (
                <a href={`mailto:${CONTACT_EMAIL}`}>
                  <Mail size={15} />
                  {CONTACT_EMAIL}
                </a>
              ) : (
                <button onClick={() => handleNavigation('Contact')}>
                  <Mail size={15} />
                  Use the contact form
                </button>
              )}

              {CONTACT_PHONE && (
                <a href={`tel:${CONTACT_PHONE.replace(/[^+\d]/g, '')}`}>
                  <Phone size={15} />
                  {CONTACT_PHONE}
                </a>
              )}

              {CONTACT_ADDRESS ? (
                <span>
                  <MapPin size={15} />
                  {CONTACT_ADDRESS}
                </span>
              ) : (
                <span>
                  <MapPin size={15} />
                  Nigerian primary health centres
                </span>
              )}
            </div>
          </div>

          <div className="public-footer-bottom">
            <span>
              © 2026 HealthBridge.
              Nigerian Primary Health Centres.
            </span>

            <div>
              <button type="button" onClick={() => handleNavigation('Privacy')}>
                Privacy
                <ArrowUpRight size={13} />
              </button>

              <button type="button" onClick={() => handleNavigation('Terms')}>
                Terms
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;