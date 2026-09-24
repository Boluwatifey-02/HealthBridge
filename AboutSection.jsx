

function AboutSection() {
  return (
    <section className="about-section" id="about">
      <div className="about-container">
        <div className="about-label">ABOUT HEALTHBRIDGE</div>

        <div className="about-grid">
          <div>
            <h2>
              Healthcare records should
              <span> work as hard as the people using them.</span>
            </h2>
          </div>

          <div className="about-content">
            <p>
              HealthBridge is an AI-powered electronic health record and health
              management system built to improve healthcare delivery in
              Nigerian primary healthcare centres.
            </p>

            <p>
              By bringing patient records, appointments, clinical workflows,
              pharmacy, laboratory services, and intelligent insights into one
              connected platform, HealthBridge helps healthcare teams spend
              less time managing paperwork and more time caring for people.
            </p>

            <div className="about-highlights">

                <div
              role="button"
              tabIndex={0}
              onClick={() => {
              window.location.href = '/patients';
              }}
              >
               <strong>01</strong>
                <span>Connected patient records</span>
              </div>

                <div
               role="button"
               tabIndex={0}
               onClick={() => {
               window.location.href = '/dashboard';
              }}
              > 
                <strong>02</strong>
                <span>Smarter healthcare workflows</span>
              </div>

                <div
                role="button"
                tabIndex={0}
                onClick={() => {
                window.location.href = '/ai-insights';
              }}
              >
                <strong>03</strong>
                <span>AI-assisted insights</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AboutSection;