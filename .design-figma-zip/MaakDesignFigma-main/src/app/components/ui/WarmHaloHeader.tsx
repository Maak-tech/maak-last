import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface WarmHaloHeaderProps {
  children: ReactNode;
  className?: string;
}

export function WarmHaloHeader({ children, className }: WarmHaloHeaderProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Warm halo glow effect */}
      <div className="pointer-events-none absolute top-0 right-0 left-0 h-64 bg-gradient-radial from-[#F1D8A3]/20 via-[#F1D8A3]/10 to-transparent blur-3xl" />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
