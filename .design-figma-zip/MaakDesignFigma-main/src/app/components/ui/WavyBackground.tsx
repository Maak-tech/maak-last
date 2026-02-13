interface WavyBackgroundProps {
  children: React.ReactNode;
  variant?: "teal" | "gold" | "light";
}

export function WavyBackground({
  children,
  variant = "teal",
}: WavyBackgroundProps) {
  const colors = {
    teal: {
      primary: "#003543",
      secondary: "#004552",
      accent: "#00667A",
    },
    gold: {
      primary: "#EB9C0C",
      secondary: "#D68A0A",
      accent: "#F5A623",
    },
    light: {
      primary: "#F0FAFB",
      secondary: "#E6F7F9",
      accent: "#D4F1F4",
    },
  };

  const selectedColors = colors[variant];

  return (
    <div className="relative overflow-hidden">
      {/* Wavy gradient background */}
      <div className="absolute inset-0 z-0">
        <svg
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 1440 320"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id={`gradient-${variant}-1`}
              x1="0%"
              x2="100%"
              y1="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor={selectedColors.primary} />
              <stop offset="50%" stopColor={selectedColors.secondary} />
              <stop offset="100%" stopColor={selectedColors.accent} />
            </linearGradient>
            <linearGradient
              id={`gradient-${variant}-2`}
              x1="0%"
              x2="100%"
              y1="0%"
              y2="0%"
            >
              <stop
                offset="0%"
                stopColor={selectedColors.accent}
                stopOpacity="0.3"
              />
              <stop
                offset="100%"
                stopColor={selectedColors.primary}
                stopOpacity="0.3"
              />
            </linearGradient>
          </defs>

          {/* Main wave */}
          <path
            d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,133.3C672,139,768,181,864,181.3C960,181,1056,139,1152,133.3C1248,128,1344,160,1392,176L1440,192L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
            fill={`url(#gradient-${variant}-1)`}
            fillOpacity="1"
          />

          {/* Secondary wave for depth */}
          <path
            d="M0,160L48,170.7C96,181,192,203,288,197.3C384,192,480,160,576,154.7C672,149,768,171,864,181.3C960,192,1056,192,1152,181.3C1248,171,1344,149,1392,138.7L1440,128L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
            fill={`url(#gradient-${variant}-2)`}
            fillOpacity="1"
          />
        </svg>

        {/* Subtle animated overlay for premium effect */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(circle at 20% 50%, ${selectedColors.accent}40 0%, transparent 50%), radial-gradient(circle at 80% 80%, ${selectedColors.primary}40 0%, transparent 50%)`,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
