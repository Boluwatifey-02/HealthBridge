import { Mail, MapPin, Phone, ArrowRight } from 'lucide-react';

function ContactSection() {
  return (
    <section className="contact-section" id="contact">
      <div className="contact-container">
        <div className="contact-intro">
          <span className="section-label">CONTACT HEALTHBRIDGE</span>

          <h2>
            Let's talk
            <span> healthcare technology.</span>
          </h2>

          <p>
            Have questions about HealthBridge or want to learn more about the
            platform? Get in touch with the HealthBridge team.
          </p>

          <div className="contact-details">
            <div className="contact-detail">
              <div className="contact-detail-icon">
                <Mail size={18} />
              </div>
              <div>
                <span>Email</span>
                <strong>contact@healthbridge.ng</strong>
              </div>
            </div>

            <div className="contact-detail">
              <div className="contact-detail-icon">
                <Phone size={18} />
              </div>
              <div>
                <span>Phone</span>
                <strong>+234 800 000 0000</strong>
              </div>
            </div>

            <div className="contact-detail">
              <div className="contact-detail-icon">
                <MapPin size={18} />
              </div>
              <div>
                <span>Location</span>
                <strong>Ikeja, Lagos State</strong>
              </div>
            </div>
          </div>
        </div>

        <form className="contact-form" onSubmit={(event) => {event.preventDefault(); 
          alert('Thank you for contacting HealthBridge. Your message has been received.');}}>
          <div className="contact-form-row">
            <label>
              Name
              <input type="text" placeholder="Your name" />
            </label>

            <label>
              Email
              <input type="email" placeholder="you@example.com" />
            </label>
          </div>

          <label>
            Subject
            <input type="text" placeholder="How can we help?" />
          </label>

          <label>
            Message
            <textarea
              rows="6"
              placeholder="Tell us what you'd like to know..."
            ></textarea>
          </label>

          <button type="submit" className="contact-submit-button">
            Send Message
            <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </section>
  );
}

export default ContactSection;