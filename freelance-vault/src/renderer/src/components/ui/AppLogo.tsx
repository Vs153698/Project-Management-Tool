interface AppLogoProps {
  size?: number
  className?: string
}

export default function AppLogo({ size = 48, className = '' }: AppLogoProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="fv-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a0a2e" />
          <stop offset="100%" stopColor="#0a1628" />
        </linearGradient>
        <linearGradient id="fv-g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="fv-g2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9d5cf7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="512" height="512" rx="110" fill="url(#fv-bg)" />

      {/* Vault outer ring */}
      <circle cx="256" cy="248" r="148" fill="none" stroke="url(#fv-g1)" strokeWidth="6" opacity="0.4" />

      {/* Vault door */}
      <circle cx="256" cy="248" r="130" fill="#12121a" />
      <circle cx="256" cy="248" r="130" fill="none" stroke="url(#fv-g1)" strokeWidth="10" />

      {/* Inner ring */}
      <circle cx="256" cy="248" r="100" fill="none" stroke="url(#fv-g1)" strokeWidth="4" opacity="0.6" />

      {/* Dial ticks */}
      <line x1="256" y1="148" x2="256" y2="178" stroke="url(#fv-g2)" strokeWidth="5" strokeLinecap="round" />
      <line x1="356" y1="248" x2="326" y2="248" stroke="url(#fv-g2)" strokeWidth="5" strokeLinecap="round" />
      <line x1="256" y1="348" x2="256" y2="318" stroke="#252538" strokeWidth="5" strokeLinecap="round" />
      <line x1="156" y1="248" x2="186" y2="248" stroke="#252538" strokeWidth="5" strokeLinecap="round" />
      <line x1="326" y1="178" x2="305" y2="199" stroke="url(#fv-g2)" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      <line x1="326" y1="318" x2="305" y2="297" stroke="#252538" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      <line x1="186" y1="178" x2="207" y2="199" stroke="#252538" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      <line x1="186" y1="318" x2="207" y2="297" stroke="#252538" strokeWidth="4" strokeLinecap="round" opacity="0.5" />

      {/* Center dial */}
      <circle cx="256" cy="248" r="46" fill="#1a1a27" stroke="url(#fv-g1)" strokeWidth="6" />
      <circle cx="256" cy="248" r="32" fill="url(#fv-g1)" opacity="0.9" />

      {/* Lock icon */}
      <rect x="245" y="247" width="22" height="16" rx="3" fill="white" opacity="0.95" />
      <path d="M249 247 v-5 a7 7 0 0 1 14 0 v5" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.95" />
      <circle cx="256" cy="254" r="2.5" fill="#1a1a27" />

      {/* Handle */}
      <rect x="368" y="236" width="36" height="24" rx="12" fill="url(#fv-g1)" opacity="0.85" />
    </svg>
  )
}
