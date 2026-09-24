import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'What is HealthBridge?',
    answer:
      'HealthBridge is an AI-powered electronic health record and health management system designed to improve healthcare delivery in Nigerian primary healthcare centres.',
  },
  {
    question: 'Who is HealthBridge designed for?',
    answer:
      'HealthBridge is designed for primary healthcare centres and the healthcare professionals who manage patient registration, clinical care, appointments, pharmacy, laboratory services, and administrative workflows.',
  },
  {
    question: 'How does HealthBridge improve patient record management?',
    answer:
      'HealthBridge replaces fragmented paper-based records with connected digital patient records that authorised healthcare staff can access and manage more efficiently.',
  },
  {
    question: 'What AI features does HealthBridge provide?',
    answer:
      'HealthBridge includes AI-assisted duplicate patient detection, follow-up recommendations, and report summaries to help healthcare professionals find useful information faster.',
  },
  {
    question: 'Is patient information secure?',
    answer:
      'HealthBridge is designed with role-based access and security controls so that healthcare information can be accessed according to the responsibilities of each authorised user.',
  },
  {
    question: 'Can HealthBridge support different healthcare departments?',
    answer:
      'Yes. The system is designed to connect workflows across reception, doctors, pharmacy, laboratory services, and administration within one platform.',
  },
];

function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex((currentIndex) =>
      currentIndex === index ? null : index
    );
  };

  return (
    <section className="faq-section" id="faq">
      <div className="faq-container">
        <div className="faq-heading">
          <span className="section-label">FREQUENTLY ASKED QUESTIONS</span>

          <h2>
            Everything you need to know
            <span> about HealthBridge.</span>
          </h2>

          <p>
            Learn more about the platform, its features, and how HealthBridge
            supports connected healthcare delivery.
          </p>
        </div>

        <div className="faq-list">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <div className={`faq-item ${isOpen ? 'open' : ''}`} key={faq.question}>
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => toggleFAQ(index)}
                  aria-expanded={isOpen}
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    size={20}
                    className="faq-icon"
                  />
                </button>

                {isOpen && (
                  <div className="faq-answer">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FAQSection;