import PublicLayout from '../layouts/PublicLayout';
import Hero from '../components/Hero';
import AboutSection from '../components/AboutSection';
import FeaturesSection from '../components/FeaturesSection';
import ServicesSection from '../components/ServicesSection';
import AIFeaturesSection from '../components/AIFeaturesSection';
import StatsSection from '../components/StatsSection';
import TestimonialsSection from '../components/TestimonialsSection';
import FAQSection from '../components/FAQSection';
import ContactSection from '../components/ContactSection';
import './LandingPage.css';

function LandingPage({ onLoginClick }) {
  const goToLogin = () => {
    if (onLoginClick) {
      onLoginClick();
      return;
    }

    window.location.href = '/login';
  };

  return (
    <PublicLayout onLoginClick={goToLogin}>
      <Hero onGetStarted={goToLogin} />
      <AboutSection />
      <FeaturesSection />
      <ServicesSection />
      <AIFeaturesSection />
      <StatsSection />
      <TestimonialsSection />
      <FAQSection />
      <ContactSection />
    </PublicLayout>
  );
}

export default LandingPage;