import { useState } from 'react';
import { Mail, MapPin, Phone, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../services/api';

/**
 * Contact details are read from the build environment. The previous version
 * printed a phone number and address that were never verified, presented as if
 * they were real. When nothing is configured the section says so rather than
 * inventing a reachable-looking contact.
 */
const CONTACT_EMAIL = String(import.meta.env.VITE_CONTACT_EMAIL || '').trim();
const CONTACT_PHONE = String(import.meta.env.VITE_CONTACT_PHONE || '').trim();
const CONTACT_ADDRESS = String(import.meta.env.VITE_CONTACT_ADDRESS || '').trim();

function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [state, setState] = useState({ submitting: false, error: null, sent: false });

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setState({ submitting: true, error: null, sent: false });

    try {
      await api.submitContactMessage(form);
      setForm({ name: '', email: '', subject: '', message: '' });
      setState({ submitting: false, error: null, sent: true });
    } catch (error) {
      setState({ submitting: false, error: error.message, sent: false });
    }
  };

  const hasContactDetails = Boolean(CONTACT_EMAIL || CONTACT_PHONE || CONTACT_ADDRESS);

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
            Have a question about HealthBridge, or want to arrange a walkthrough
            for your centre? Send a message and it is stored for an administrator
            to read and reply to.
          </p>

          {hasContactDetails ? (
            <div className="contact-details">
              {CONTACT_EMAIL && (
                <div className="contact-detail">
                  <div className="contact-detail-icon">
                    <Mail size={18} />
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{CONTACT_EMAIL}</strong>
                  </div>
                </div>
              )}

              {CONTACT_PHONE && (
                <div className="contact-detail">
                  <div className="contact-detail-icon">
                    <Phone size={18} />
                  </div>
                  <div>
                    <span>Phone</span>
                    <strong>{CONTACT_PHONE}</strong>
                  </div>
                </div>
              )}

              {CONTACT_ADDRESS && (
                <div className="contact-detail">
                  <div className="contact-detail-icon">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <span>Location</span>
                    <strong>{CONTACT_ADDRESS}</strong>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="contact-details-missing">
              No direct contact details are configured for this deployment. The
              form below is the reliable way to reach us.
            </p>
          )}
        </div>

        <form className="contact-form" onSubmit={handleSubmit} noValidate>
          <div className="contact-form-row">
            <label>
              Name
              <input
                id="contact-name"
                name="name"
                type="text"
                value={form.name}
                onChange={update('name')}
                placeholder="Your name"
                required
                maxLength={120}
              />
            </label>

            <label>
              Email
              <input
                id="contact-email"
                name="email"
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="you@example.com"
                required
                maxLength={120}
              />
            </label>
          </div>

          <label>
            Subject
            <input
              id="contact-subject"
              name="subject"
              type="text"
              value={form.subject}
              onChange={update('subject')}
              placeholder="How can we help?"
              maxLength={255}
            />
          </label>

          <label>
            Message
            <textarea
              id="contact-message"
              name="message"
              rows="6"
              value={form.message}
              onChange={update('message')}
              placeholder="Tell us what you'd like to know..."
              required
              maxLength={4000}
            ></textarea>
          </label>

          {state.error && (
            <p className="contact-form-error" role="alert">
              <AlertTriangle size={15} />
              {state.error}
            </p>
          )}

          {state.sent && (
            <p className="contact-form-success" role="status">
              <CheckCircle2 size={15} />
              Your message has been recorded. An administrator can read it now.
            </p>
          )}

          <button type="submit" className="contact-submit-button" disabled={state.submitting}>
            {state.submitting ? 'Sending…' : 'Send Message'}
            {!state.submitting && <ArrowRight size={17} />}
          </button>
        </form>
      </div>
    </section>
  );
}

export default ContactSection;
