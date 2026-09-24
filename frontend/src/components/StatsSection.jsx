const stats = [
  {
    value: '100',
    label: 'Patient records',
  },
  {
    value: '24/7',
    label: 'Access to records',
  },
  {
    value: '6',
    label: 'Connected workflows',
  },
  {
    value: '100%',
    label: 'Digital records',
  },
];

function StatsSection() {
  return (
    <section className="stats-section">
      <div className="stats-container">
        <div className="stats-intro">
          <span className="section-label">HEALTHBRIDGE BY THE NUMBERS</span>

          <h2>
            Built around the way
            <span> healthcare teams work.</span>
          </h2>
        </div>

        <div className="stats-grid">
          {stats.map((stat) => (
            <div className="stat-item" key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default StatsSection;