import PublicLayout from '../layouts/PublicLayout';
import Hero from '../components/Hero';
import AboutSection from '../components/AboutSection';
import FeaturesSection from '../components/FeaturesSection';
import ServicesSection from '../components/ServicesSection';
import AIFeaturesSection from '../components/AIFeaturesSection';
import StatsSection from '../components/StatsSection';
import WorkflowSection from '../components/WorkflowSection';
import FAQSection from '../components/FAQSection';
import ContactSection from '../components/ContactSection';
import './LandingPage.css';

function LandingPage({ onLoginClick, onPatientLoginClick }) {
  const goToLogin = () => {
    if (onLoginClick) {
      onLoginClick();
      return;
    }

    window.location.href = '/login';
  };

  const goToPatientLogin = () => {
    if (onPatientLoginClick) {
      onPatientLoginClick();
      return;
    }

    window.location.href = '/patient-portal';
  };

  return (
    <PublicLayout onLoginClick={goToLogin} onPatientLoginClick={goToPatientLogin}>
      <Hero onGetStarted={goToLogin} />
      <AboutSection />
      <FeaturesSection />
      <ServicesSection />
      <AIFeaturesSection />
      <StatsSection />
      <WorkflowSection />
      <FAQSection />
      <ContactSection />
    </PublicLayout>
  );
}

export default LandingPage;