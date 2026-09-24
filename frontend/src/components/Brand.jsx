function PulseBridgeMark({ size = 40, animate = true }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 40 L18 40 L23 22 L29 50 L34 30 L38 40 L46 40"
        stroke="var(--gold)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={animate ? 'brand-pulse-animated' : ''}
      />

      <path
        d="M4 48 Q32 30 60 48"
        stroke="var(--white)"
        strokeOpacity="0.55"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function Brand({ dark = false, size = 30, animate = false }) {
  return (
    <div className={`brand ${dark ? 'brand-dark' : ''}`}>
      <PulseBridgeMark size={size} animate={animate} />

      <span className="brand-name">
        HealthBridge
      </span>
    </div>
  );
}

export default Brand;