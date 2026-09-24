import {
  Stethoscope,
  ClipboardList,
  Pill,
  FlaskConical,
} from 'lucide-react';

const services = [
  {
    icon: Stethoscope,
    title: 'Clinical Care',
    description:
      'Support healthcare professionals with connected patient information and streamlined clinical workflows.',
  },
  {
    icon: ClipboardList,
    title: 'Patient Management',
    description:
      'Register patients, manage digital records, and make important patient information easier to access.',
  },
  {
    icon: Pill,
    title: 'Pharmacy Services',
    description:
      'Connect prescriptions with pharmacy workflows and help healthcare centres keep track of medication inventory.',
  },
  {
    icon: FlaskConical,
    title: 'Laboratory Services',
    description:
      'Support laboratory requests and results within the same connected healthcare environment.',
  },
];

function ServicesSection() {
  return (
    <section className="services-section" id="services">
      <div className="services-container">
        <div className="services-heading">
          <span className="section-label">OUR SERVICES</span>

          <h2>
            One platform for
            <span> connected care.</span>
          </h2>

          <p>
            HealthBridge brings essential healthcare workflows together so
            primary healthcare teams can work from one connected system.
          </p>
        </div>

        <div className="services-grid">
          {services.map((service) => {
            const Icon = service.icon;

              return (
    <article
      key={service.title}
      className="service-card"
      onClick={() => {

  if (service.title === 'Patient Management') {
    window.location.href = '/patients';
  }

  if (service.title === 'Pharmacy Services') {
    window.location.href = '/pharmacy';
  }

  if (service.title === 'Clinical Care') {
  window.location.href = '/patients';
}

if (service.title === 'Laboratory Services') {
  window.location.href = '/laboratory';
}

}}
style={{
  cursor:
    service.title === 'Patient Management' ||
    service.title === 'Pharmacy Services'
      ? 'pointer'
      : 'default',
}}
    >
      <div className="service-icon">
        <service.icon size={22} />
      </div>

                <h3>{service.title}</h3>

                <p>{service.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default ServicesSection;