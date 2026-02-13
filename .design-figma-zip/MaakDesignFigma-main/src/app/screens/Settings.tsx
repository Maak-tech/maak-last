import {
  Bell,
  ChevronRight,
  Globe,
  HelpCircle,
  Link2,
  LogOut,
  Phone,
  Shield,
  User,
} from "lucide-react";
import { Avatar } from "../components/ui/Avatar";
import { BottomNav } from "../components/ui/BottomNav";
import { Card } from "../components/ui/Card";
import { WavyBackground } from "../components/ui/WavyBackground";
import { useLanguage } from "../context/LanguageContext";

export function Settings() {
  const { t, language, setLanguage } = useLanguage();

  const settingsSections = [
    {
      title: "Account",
      items: [
        {
          icon: User,
          label: "Profile",
          value: "Sarah Ahmed",
          action: () => {},
        },
        {
          icon: Globe,
          label: t("settings.language"),
          value: language === "en" ? "English" : "العربية",
          action: () => setLanguage(language === "en" ? "ar" : "en"),
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: Bell,
          label: t("settings.notifications"),
          value: "Enabled",
          action: () => {},
        },
        {
          icon: Shield,
          label: t("settings.privacy"),
          value: null,
          action: () => {},
        },
      ],
    },
    {
      title: "Connections",
      items: [
        {
          icon: Link2,
          label: t("settings.integrations"),
          value: "2 connected",
          action: () => {},
        },
        {
          icon: Phone,
          label: t("settings.emergency"),
          value: "3 contacts",
          action: () => {},
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: HelpCircle,
          label: t("settings.help"),
          value: null,
          action: () => {},
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FAFB] via-[#F9FDFE] to-[#E6F7F9] pb-24">
      {/* Header with Wavy Background */}
      <WavyBackground variant="teal">
        <div className="rounded-b-3xl px-6 pt-12 pb-8">
          <h1 className="mb-6 font-semibold text-3xl text-white">
            {t("nav.settings")}
          </h1>

          {/* Profile card */}
          <Card className="bg-white/95 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <Avatar name="Sarah Ahmed" size="lg" />
              <div className="flex-1">
                <h3 className="mb-1 font-semibold text-[#1A1D1F]">
                  Sarah Ahmed
                </h3>
                <p className="text-[#6C7280] text-sm">Primary caregiver</p>
                <p className="text-[#6C7280] text-sm">
                  sarah.ahmed@example.com
                </p>
              </div>
              <button className="rounded-lg bg-[#F3F4F6] px-4 py-2 font-medium text-[#4E5661] text-sm transition-colors hover:bg-[#E5E7EB]">
                Edit
              </button>
            </div>
          </Card>
        </div>
      </WavyBackground>

      {/* Settings sections */}
      <div className="space-y-6 px-6">
        {settingsSections.map((section) => (
          <div key={section.title}>
            <h2 className="mb-3 font-semibold text-[#9CA3AF] text-sm uppercase tracking-wide">
              {section.title}
            </h2>
            <Card className="divide-y divide-[#E5E7EB]">
              {section.items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    className="flex w-full items-center gap-3 px-4 py-4 transition-colors hover:bg-[#F9FAFB]"
                    key={index}
                    onClick={item.action}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#003543]/5">
                      <Icon className="h-5 w-5 text-[#003543]" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-[#1A1D1F]">{item.label}</p>
                      {item.value && (
                        <p className="text-[#6C7280] text-sm">{item.value}</p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />
                  </button>
                );
              })}
            </Card>
          </div>
        ))}

        {/* App info */}
        <div className="pt-4">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-center gap-2">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-[#003543]" />
                <div className="h-2 w-2 rounded-full bg-[#EB9C0C]" />
              </div>
              <span className="font-semibold text-[#003543]">
                {t("app.name")}
              </span>
            </div>
            <p className="mb-1 text-center text-[#6C7280] text-sm">
              Version 1.0.0
            </p>
            <p className="text-center text-[#9CA3AF] text-xs">
              {t("app.tagline")}
            </p>
          </Card>
        </div>

        {/* Sign out */}
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-6 py-4 font-medium text-[#EF4444] transition-colors hover:bg-[#FEE2E2]">
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
