import {
  Stethoscope,
  ClipboardList,
  Pill,
  FlaskConical,
  ArrowUpRight,
} from 'lucide-react';

/**
 * Each service links to the part of the application it describes.
 *
 * The cards previously navigated with `window.location.href`, which reloads the
 * whole application and discards the current page state, and only two of the
 * four cards were wired up at all. The link is now declared with the card, so a
 * card that has no page behind it does not look clickable.
 */
const services = [
  {
    icon: Stethoscope,
    title: 'Clinical Care',
    path: '/patients',
    description:
      'Record consultations, diagnoses and treatment plans against a patient, with the history kept in one place.',
  },
  {
    icon: ClipboardList,
    title: 'Patient Management',
    path: '/patients',
    description:
      'Register patients, search their records, and keep contact and demographic details current.',
  },
  {
    icon: Pill,
    title: 'Pharmacy Services',
    path: '/pharmacy',
    description:
      'Issue and dispense prescriptions, with stock reduced on dispensing and dispensing blocked twice over.',
  },
  {
    icon: FlaskConical,
    title: 'Laboratory Services',
    path: '/laboratory',
    description:
      'Raise laboratory requests, record results against them, and keep the request and its result together.',
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
              <a key={service.title} className="service-card" href={service.path}>
                <div className="service-icon">
                  <Icon size={22} />
                </div>

                <h3>{service.title}</h3>

                <p>{service.description}</p>

                <span className="service-card-link">
                  Open
                  <ArrowUpRight size={16} />
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default ServicesSection;
