/**
 * Facts about the system rather than invented statistics.
 *
 * This section previously showed "100 patient records", "24/7 access" and
 * "100% digital records" as though they were measured results. None of them
 * were, and a visitor had no way to tell. Every entry below describes a
 * capability that is actually implemented, so the claim can be checked.
 */
const capabilities = [
  {
    value: '6',
    label: 'Connected workflows',
    detail: 'Registration, appointments, consultations, prescriptions, laboratory and pharmacy',
  },
  {
    value: '5',
    label: 'Staff roles',
    detail: 'Each role sees and changes only what its work requires',
  },
  {
    value: '1',
    label: 'Record per patient',
    detail: 'Every appointment, note, prescription and result sits on that one record',
  },
  {
    value: '100%',
    label: 'Recorded actions',
    detail: 'Who viewed or changed a patient record is written to an audit trail',
  },
];

function StatsSection() {
  return (
    <section className="stats-section">
      <div className="stats-container">
        <div className="stats-intro">
          <span className="section-label">WHAT HEALTHBRIDGE DOES</span>

          <h2>
            Built around the way
            <span> healthcare teams work.</span>
          </h2>
        </div>

        <div className="stats-grid">
          {capabilities.map((capability) => (
            <div className="stat-item" key={capability.label}>
              <strong>{capability.value}</strong>
              <span>{capability.label}</span>
              <small>{capability.detail}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default StatsSection;
