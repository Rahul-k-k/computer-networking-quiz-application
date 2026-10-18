// The SpeedNet Arena mark: a lightning bolt with orbiting network nodes on a
// puffy gradient badge. Mirrors public/logo.svg (used as the favicon).
export default function Logo({ size = 40, withText = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label="SpeedNet Arena"
        className="drop-shadow-sm shrink-0"
      >
        <defs>
          <linearGradient id="logoBadge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#A78BFA" />
            <stop offset="0.55" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#F79E93" />
          </linearGradient>
        </defs>
        <rect x="6" y="6" width="52" height="52" rx="16" fill="url(#logoBadge)" />
        <rect x="6" y="6" width="52" height="52" rx="16" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1.5" />
        <g stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.6" fill="none">
          <line x1="16" y1="20" x2="32" y2="32" />
          <line x1="48" y1="18" x2="32" y2="32" />
          <line x1="18" y1="46" x2="32" y2="32" />
          <line x1="47" y1="47" x2="32" y2="32" />
        </g>
        <g fill="#ffffff">
          <circle cx="16" cy="20" r="3.2" />
          <circle cx="48" cy="18" r="3.2" />
          <circle cx="18" cy="46" r="3.2" />
          <circle cx="47" cy="47" r="3.2" />
        </g>
        <path
          d="M35 15 L22 35 L31 35 L28 49 L43 27 L33 27 Z"
          fill="#FDE68A"
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      {withText && (
        <span className="font-display font-extrabold text-slate-900 leading-none whitespace-nowrap text-xl">
          SpeedNet<span className="text-grape-500">Arena</span>
        </span>
      )}
    </span>
  );
}
