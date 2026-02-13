export function WatermarkPattern() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          height="160"
          id="maakPattern"
          patternUnits="userSpaceOnUse"
          width="160"
          x="0"
          y="0"
        >
          {/* Two dots representing the logo */}
          <circle cx="30" cy="30" fill="#003543" r="3" />
          <circle cx="50" cy="30" fill="#EB9C0C" r="3" />

          {/* Additional dots for pattern */}
          <circle cx="100" cy="60" fill="#003543" opacity="0.5" r="2" />
          <circle cx="60" cy="100" fill="#003543" opacity="0.5" r="2" />
          <circle cx="130" cy="130" fill="#003543" opacity="0.5" r="2" />

          {/* Flowing calligraphy curve */}
          <path
            d="M 20 50 Q 60 20, 100 50 T 140 50"
            fill="none"
            opacity="0.3"
            stroke="#003543"
            strokeWidth="1"
          />

          {/* Secondary curve */}
          <path
            d="M 40 90 Q 70 70, 100 90 T 130 90"
            fill="none"
            opacity="0.2"
            stroke="#EB9C0C"
            strokeWidth="0.8"
          />
        </pattern>
      </defs>
      <rect fill="url(#maakPattern)" height="100%" width="100%" />
    </svg>
  );
}
