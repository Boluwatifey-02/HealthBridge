const testimonials = [
  {
    quote:
      'HealthBridge brings the information our healthcare teams need into one connected place.',
    name: 'Healthcare Administrator',
    role: 'Primary Healthcare Centre',
  },
  {
    quote:
      'Having patient records, appointments, and clinical workflows connected makes everyday care much easier to manage.',
    name: 'Medical Officer',
    role: 'Primary Healthcare Centre',
  },
  {
    quote:
      'The intelligent features can help staff find important information faster while keeping the healthcare professional in control.',
    name: 'Health Information Officer',
    role: 'Primary Healthcare Centre',
  },
];

function TestimonialsSection() {
  return (
    <section className="testimonials-section">
      <div className="testimonials-container">
        <div className="testimonials-heading">
          <span className="section-label">FROM THE PEOPLE WHO USE IT</span>

          <h2>
            Technology should make
            <span> care feel more connected.</span>
          </h2>
        </div>

        <div className="testimonials-grid">
          {testimonials.map((testimonial) => (
            <article
              className="testimonial-card"
              key={testimonial.name}
            >
              <div className="testimonial-mark">“</div>

              <p>{testimonial.quote}</p>

              <div className="testimonial-person">
                <div className="testimonial-avatar">
                  {testimonial.name.charAt(0)}
                </div>

                <div>
                  <strong>{testimonial.name}</strong>
                  <span>{testimonial.role}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;