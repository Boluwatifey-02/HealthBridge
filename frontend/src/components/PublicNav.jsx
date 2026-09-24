import { Menu, X, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import Brand from './Brand';

function PublicNav({ page = 'Home', setPage, onLogin }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    'Home',
    'About',
    'Features',
    'Services',
    'AI Features',
    'Contact',
  ];

 const handleNavigation = (link) => {
  if (setPage) setPage(link);

  const sectionIds = {
    Home: 'home',
    About: 'about',
    Features: 'features',
    Services: 'services',
    'AI Features': 'ai-features',
    Contact: 'contact',
  };

  const section = document.getElementById(sectionIds[link]);

  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }

  setMobileOpen(false);
};
  
  return (
    <header className="public-nav-wrapper">
      <div className="public-nav-container">
        <button
          type="button"
          className="public-nav-brand"
          onClick={() => handleNavigation('Home')}
          aria-label="Go to HealthBridge home"
        >
          <Brand dark />
        </button>

        <nav className="public-nav-links">
          {links.map((link) => (
            <button
              type="button"
              key={link}
              onClick={() => handleNavigation(link)}
              className={page === link ? 'active' : ''}
            >
              {link}
            </button>
          ))}
        </nav>

        <div className="public-nav-login">
          <button
            type="button"
            className="nav-login-button"
            onClick={onLogin}
          >
            Login
            <ArrowRight size={15} />
          </button>
        </div>

        <button
          type="button"
          className="mobile-menu-button"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="mobile-nav-menu">
          {links.map((link) => (
            <button
              type="button"
              key={link}
              onClick={() => handleNavigation(link)}
              className={page === link ? 'active' : ''}
            >
              {link}
            </button>
          ))}

          <button
            type="button"
            className="mobile-login-button"
            onClick={onLogin}
          >
            Login
          </button>
        </div>
      )}
    </header>
  );
}

export default PublicNav;