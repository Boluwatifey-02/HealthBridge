import { BrainCircuit, UserRoundCheck, FileText, FileWarning } from 'lucide-react';
import './AIFeaturesSection.css';

const signals = [
  {
    icon: UserRoundCheck,
    title: 'Duplicate patient detection',
    description:
      'Finds patient records that share a phone number, so a person registered twice can be merged before their history is split in two.',
  },
  {
    icon: BrainCircuit,
    title: 'Reviews due',
    description:
      'Lists active patients whose last recorded visit was more than 90 days ago, and consultations that advised a return with nothing booked.',
  },
  {
    icon: FileWarning,
    title: 'Incomplete record detection',
    description:
      'Flags active patients missing a phone number, address, allergy status or recorded condition.',
  },
  {
    icon: FileText,
    title: 'Results needing review',
    description:
      'Picks out completed laboratory results whose text marks a finding as abnormal or critical, so they are read rather than filed unread.',
  },
];

function AIFeaturesSection() {
  return (
    <section className="ai-features-section" id="ai-features">
      <div className="ai-features-container">
        <div className="ai-features-layout">
          <div className="ai-features-intro">
            <span className="section-label">RECORD INSIGHTS</span>

            <h2>
              Signals that point
              <span> to work worth doing.</span>
            </h2>

            <p>
              HealthBridge counts what is genuinely in the records and brings
              the ones that need attention to the front. These are rules applied
              to the database, not a machine learning model: no outside service
              receives patient data, and nothing here produces a diagnosis. A
              clinician still decides what any of it means.
            </p>

            <div className="ai-status">
              <span className="ai-status-dot" aria-hidden="true" />
              <span>Rule-based analysis, computed on this system</span>
            </div>
          </div>

          <div className="ai-features-list">
            {signals.map((feature) => {
              const Icon = feature.icon;

              return (
                <article className="ai-feature-card" key={feature.title}>
                  <div className="ai-feature-icon">
                    <Icon size={21} strokeWidth={1.7} />
                  </div>

                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default AIFeaturesSection;