import {
  Activity,
  Home,
  Layout,
  MessageCircle,
  Sparkles,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router";
import { Card } from "../components/ui/Card";

export function ScreenNavigator() {
  const navigate = useNavigate();

  const screens = [
    {
      path: "/onboarding",
      name: "Onboarding",
      icon: Sparkles,
      description: "Welcome flow with language selection",
      color: "#EB9C0C",
    },
    {
      path: "/home",
      name: "Home",
      icon: Home,
      description: "Dashboard with clean white header",
      color: "#003543",
    },
    {
      path: "/track",
      name: "Track",
      icon: Activity,
      description: "Log symptoms, medications, and vitals",
      color: "#10B981",
    },
    {
      path: "/zeina",
      name: "Zeina AI Agent",
      icon: MessageCircle,
      description: "Chat interface with your AI care agent",
      color: "#EB9C0C",
    },
    {
      path: "/family",
      name: "Family",
      icon: Users,
      description: "Family circle with member overview",
      color: "#3B82F6",
    },
    {
      path: "/profile",
      name: "Profile",
      icon: User,
      description: "User profile and health overview",
      color: "#8B5CF6",
    },
    {
      path: "/trends",
      name: "Observability Trends",
      icon: TrendingUp,
      description: "Charts with context and risk analysis",
      color: "#3B82F6",
    },
    {
      path: "/settings",
      name: "Settings",
      icon: Layout,
      description: "Preferences and integrations",
      color: "#6C7280",
    },
    {
      path: "/design-system",
      name: "Design System",
      icon: Layout,
      description: "Complete component library",
      color: "#8B5CF6",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F9FDFE] pb-8">
      {/* Header */}
      <div className="border-[#E5E7EB] border-b bg-white px-6 pt-12 pb-12">
        <div className="text-center">
          <h1 className="mb-2 font-bold text-3xl text-[#003543]">
            Maak Platform
          </h1>
          <p className="text-[#6C7280]">
            Proactive Family Health Observability
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="px-6 pt-6">
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-[#003543] to-[#03303C] p-6 text-white">
          <h2 className="mb-4 font-semibold text-xl">Key Features</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="mb-2 text-2xl">📊</div>
              <p className="font-medium text-sm">Monitoring</p>
              <p className="text-white/70 text-xs">Wearables + Sensors</p>
            </div>
            <div>
              <div className="mb-2 text-2xl">🔍</div>
              <p className="font-medium text-sm">Observability</p>
              <p className="text-white/70 text-xs">Context + Trends</p>
            </div>
            <div>
              <div className="mb-2 text-2xl">🤖</div>
              <p className="font-medium text-sm">AI Agent</p>
              <p className="text-white/70 text-xs">Insights → Actions</p>
            </div>
          </div>
        </div>

        {/* Screens */}
        <div className="mb-8">
          <h2 className="mb-4 font-semibold text-2xl text-[#1A1D1F]">
            Explore Screens
          </h2>
          <div className="grid gap-3">
            {screens.map((screen) => {
              const Icon = screen.icon;
              return (
                <Card
                  className="cursor-pointer p-4 transition-all hover:shadow-lg"
                  key={screen.path}
                  onClick={() => navigate(screen.path)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${screen.color}15` }}
                    >
                      <Icon
                        className="h-7 w-7"
                        style={{ color: screen.color }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-1 font-semibold text-[#1A1D1F]">
                        {screen.name}
                      </h3>
                      <p className="text-[#6C7280] text-sm">
                        {screen.description}
                      </p>
                    </div>
                    <div className="text-[#9CA3AF]">→</div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Design Notes */}
        <Card className="bg-[#FFF9EF] p-6">
          <h3 className="mb-3 font-semibold text-[#1A1D1F]">
            Design Highlights
          </h3>
          <ul className="space-y-2 text-[#4E5661] text-sm">
            <li className="flex items-start gap-2">
              <span className="text-[#EB9C0C]">✓</span>
              <span>
                <strong>Premium & Calm:</strong> Soft colors, generous spacing,
                readable typography
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#EB9C0C]">✓</span>
              <span>
                <strong>Memorable Background:</strong> Warm halo + watermark
                pattern (onboarding, Zeina)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#EB9C0C]">✓</span>
              <span>
                <strong>RTL Support:</strong> Language toggle in onboarding &
                settings
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#EB9C0C]">✓</span>
              <span>
                <strong>Observability First:</strong> Context with every alert,
                trends with explanations
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#EB9C0C]">✓</span>
              <span>
                <strong>8pt Grid System:</strong> Consistent spacing throughout
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
