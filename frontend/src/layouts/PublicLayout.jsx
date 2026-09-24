import PublicNav from '../components/PublicNav';
import Brand from '../components/Brand';
import {
  Mail,
  Phone,
  MapPin,
  ArrowUpRight,
} from 'lucide-react';
import { useState } from 'react';

function PublicLayout({ children }) {
  const [page, setPage] = useState('Home');

  const handleLogin = () => {
  window.location.href = '/login';
};

  const handleNavigation = (section) => {
    setPage(section);

    if (section === 'Privacy' || section === 'Terms') {
      window.location.href = '/security';
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

              <a href="mailto:contact@healthbridge.ng">
                <Mail size={15} />
                contact@healthbridge.ng
              </a>

              <a href="tel:+2348000000000">
                <Phone size={15} />
                +234 800 000 0000
              </a>

              <span>
                <MapPin size={15} />
                Ikeja, Lagos State
              </span>
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