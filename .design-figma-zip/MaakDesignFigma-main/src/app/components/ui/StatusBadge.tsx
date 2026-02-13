import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface StatusBadgeProps {
  status: "stable" | "monitor" | "attention";
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = {
    stable: {
      icon: CheckCircle2,
      label: "Stable",
      bg: "bg-[#10B981]/10",
      text: "text-[#10B981]",
      border: "border-[#10B981]/20",
    },
    monitor: {
      icon: AlertTriangle,
      label: "Monitor",
      bg: "bg-[#F59E0B]/10",
      text: "text-[#F59E0B]",
      border: "border-[#F59E0B]/20",
    },
    attention: {
      icon: AlertCircle,
      label: "Needs Attention",
      bg: "bg-[#EF4444]/10",
      text: "text-[#EF4444]",
      border: "border-[#EF4444]/20",
    },
  };

  const { icon: Icon, label, bg, text, border } = config[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
        bg,
        text,
        border,
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium text-xs">{label}</span>
    </div>
  );
}
