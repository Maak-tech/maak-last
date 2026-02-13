import { Activity, Home, MessageCircle, User, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { useLanguage } from "../../context/LanguageContext";
import { cn } from "../../lib/utils";

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const tabs = [
    { id: "home", icon: Home, label: "Home", path: "/home" },
    { id: "track", icon: Activity, label: "Track", path: "/track" },
    { id: "zeina", icon: MessageCircle, label: "Zeina", path: "/zeina" },
    { id: "family", icon: Users, label: "Family", path: "/family" },
    { id: "profile", icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <nav className="safe-area-bottom fixed right-0 bottom-0 left-0 z-50 border-[#E5E7EB] border-t bg-white/95 shadow-lg backdrop-blur-lg">
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map(({ id, icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          return (
            <button
              className={cn(
                "relative flex min-w-[60px] flex-col items-center gap-1 rounded-xl px-3 py-2.5 transition-all duration-300",
                isActive
                  ? "scale-105 text-white"
                  : "text-[#9CA3AF] hover:bg-[#F0FAFB] hover:text-[#003543]"
              )}
              key={id}
              onClick={() => navigate(path)}
            >
              {/* Active tab gradient background */}
              {isActive && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#003543] via-[#004552] to-[#00667A] shadow-md" />
              )}

              {/* Icon and label */}
              <Icon
                className={cn(
                  "relative z-10 h-6 w-6 transition-all duration-300",
                  isActive && "drop-shadow-sm"
                )}
              />
              <span
                className={cn(
                  "relative z-10 font-medium text-xs transition-all duration-300",
                  isActive && "font-semibold"
                )}
              >
                {label}
              </span>

              {/* Active indicator dot */}
              {isActive && (
                <div className="absolute -top-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#EB9C0C]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
