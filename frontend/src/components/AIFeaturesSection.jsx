import { BrainCircuit, UserRoundCheck, FileText, Sparkles, FileWarning } from 'lucide-react';
import './AIFeaturesSection.css';

const aiFeatures = [
  {
    icon: UserRoundCheck,
    title: 'Duplicate Patient Detection',
    description:
      'Identify possible duplicate patient records using intelligent matching, helping healthcare teams maintain cleaner records.',
  },
  {
    icon: BrainCircuit,
    title: 'Follow-up Recommendations',
    description:
      'Use patient history and recent activity to highlight patients who may require follow-up care.',
  },
  {
    icon: FileText,
    title: 'AI Report Summaries',
    description:
      'Turn relevant patient and healthcare data into concise summaries that help staff understand information faster.',
  },
  {
    icon: FileWarning,
    title: 'Incomplete Record Detection',
    description:
      'Identify patient records with missing information so healthcare teams can complete important details.',
  },
];

function AIFeaturesSection() {
  return (
    <section className="ai-features-section" id="ai-features">
      <div className="ai-features-container">
        <div className="ai-features-layout">
          <div className="ai-features-intro">
            <span className="section-label">INTELLIGENT HEALTHCARE</span>

            <h2>
              AI that supports
              <span> better decisions.</span>
            </h2>

            <p>
              HealthBridge uses practical AI capabilities to reduce repetitive
              work, surface useful information, and help healthcare professionals
              make more informed decisions.
            </p>

            <div className="ai-status">
              <span className="ai-status-dot" aria-hidden="true" />
              <span>AI assistance available</span>
            </div>
          </div>

          <div className="ai-features-list">
            {aiFeatures.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  className="ai-feature-card"
                  key={feature.title}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    window.location.href = '/ai-insights';
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      window.location.href = '/ai-insights';
                    }
                  }}
                >
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