import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "../../lib/utils";

interface AlertCardProps {
  severity: "critical" | "important" | "info";
  title: string;
  message: string;
  timestamp: string;
  onAction?: () => void;
}

export function AlertCard({
  severity,
  title,
  message,
  timestamp,
  onAction,
}: AlertCardProps) {
  const config = {
    critical: {
      icon: AlertCircle,
      bg: "bg-[#FEE2E2]",
      border: "border-l-[#DC2626]",
      iconColor: "text-[#DC2626]",
    },
    important: {
      icon: AlertTriangle,
      bg: "bg-[#FEF3C7]",
      border: "border-l-[#F59E0B]",
      iconColor: "text-[#F59E0B]",
    },
    info: {
      icon: Info,
      bg: "bg-[#DBEAFE]",
      border: "border-l-[#3B82F6]",
      iconColor: "text-[#3B82F6]",
    },
  };

  const { icon: Icon, bg, border, iconColor } = config[severity];

  return (
    <div
      className={cn(
        "rounded-xl border-l-4 p-4 shadow-sm",
        bg,
        border,
        onAction && "cursor-pointer transition-shadow hover:shadow-md"
      )}
      onClick={onAction}
    >
      <div className="flex gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 flex-shrink-0", iconColor)} />
        <div className="min-w-0 flex-1">
          <h4 className="mb-1 font-semibold text-[#1A1D1F]">{title}</h4>
          <p className="mb-2 text-[#4E5661] text-sm">{message}</p>
          <p className="text-[#6C7280] text-xs">{timestamp}</p>
        </div>
      </div>
    </div>
  );
}
