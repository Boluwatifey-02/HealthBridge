/**
 * What a clinic actually does with HealthBridge, step by step.
 *
 * This replaced a set of named testimonials attributed to "Healthcare
 * Administrator", "Medical Officer" and "Health Information Officer". No such
 * people were ever consulted and the quotations were invented, so presenting
 * them as real user feedback was misleading. The section now describes the
 * actual workflow instead, which is verifiable by using the system.
 */
const workflow = [
  {
    step: 'Register',
    title: 'Reception registers the patient',
    detail:
      'Name, contact details, blood group, genotype, allergies and presenting condition are captured once. A search finds the existing record instead of creating a duplicate.',
  },
  {
    step: 'Book',
    title: 'The appointment is booked against that record',
    detail:
      'The clinician and slot are chosen, and the system refuses a double booking for the same clinician at the same time.',
  },
  {
    step: 'Consult',
    title: 'The doctor records the consultation',
    detail:
      'Complaint, diagnosis, treatment and follow-up are saved to the patient, and the last-visit date updates from the consultation rather than being maintained separately.',
  },
  {
    step: 'Test',
    title: 'Laboratory work is requested and reported',
    detail:
      'A test request is linked to the patient, and when the result is filed the request completes and the result appears on the patient record.',
  },
  {
    step: 'Treat',
    title: 'Prescription is issued, then dispensed',
    detail:
      'The doctor issues the prescription and the pharmacy dispenses it. Dispensing reduces the stock on hand and is refused if there is not enough to cover the quantity.',
  },
];

function WorkflowSection() {
  return (
    <section className="testimonials-section">
      <div className="testimonials-container">
        <div className="testimonials-heading">
          <span className="section-label">HOW A VISIT WORKS</span>

          <h2>
            From registration
            <span> to dispensed medicine.</span>
          </h2>
        </div>

        <div className="testimonials-grid">
          {workflow.map((item) => (
            <article className="testimonial-card" key={item.step}>
              <div className="testimonial-mark">{item.step}</div>

              <p>{item.detail}</p>

              <div className="testimonial-person">
                <div>
                  <strong>{item.title}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default WorkflowSection;
