import {
  Activity,
  ChevronDown,
  Heart,
  MessageCircle,
  Moon,
  Pill,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router";
import { AlertCard } from "../components/ui/AlertCard";
import { Avatar } from "../components/ui/Avatar";
import { BottomNav } from "../components/ui/BottomNav";
import { Card } from "../components/ui/Card";
import { Sparkline } from "../components/ui/Sparkline";
import { StatusBadge } from "../components/ui/StatusBadge";
import { WavyBackground } from "../components/ui/WavyBackground";
import { useLanguage } from "../context/LanguageContext";

export function Home() {
  const { t, direction } = useLanguage();
  const navigate = useNavigate();

  // Sample data
  const lovedOnes = [
    {
      name: "Sarah Ahmed",
      relationship: "Mom",
      status: "stable" as const,
      sparklineData: [72, 73, 71, 74, 72, 73, 75],
    },
    {
      name: "Omar Hassan",
      relationship: "Dad",
      status: "monitor" as const,
      sparklineData: [68, 70, 72, 75, 73, 76, 78],
    },
  ];

  const highlights = [
    {
      icon: Moon,
      label: "Sleep Quality",
      value: "7.5 hrs",
      change: "+12%",
      positive: true,
    },
    {
      icon: Activity,
      label: "Activity",
      value: "8,234 steps",
      change: "+5%",
      positive: true,
    },
    {
      icon: Heart,
      label: "Heart Rate",
      value: "72 bpm",
      change: "Steady",
      positive: true,
    },
    {
      icon: Pill,
      label: "Medications",
      value: "100%",
      change: "On track",
      positive: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FAFB] via-[#F9FDFE] to-[#E6F7F9] pb-24">
      <WavyBackground variant="teal">
        {/* Header */}
        <div className="px-6 pt-12 pb-8">
          {/* Logo and profile */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-white" />
                <div className="h-2 w-2 rounded-full bg-[#EB9C0C]" />
              </div>
              <span className="font-semibold text-white text-xl">
                {t("app.name")}
              </span>
            </div>

            {/* Family switcher */}
            <button className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm transition-colors hover:bg-white/20">
              <Avatar name="Sarah Ahmed" size="sm" />
              <ChevronDown className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* Greeting */}
          <div className="mt-20">
            <h1 className="mb-2 font-bold text-2xl text-white">
              {t("welcome.back")}, Sarah
            </h1>
            <p className="text-sm text-white/80">{t("home.stable")}</p>
          </div>
        </div>
      </WavyBackground>

      <div className="space-y-6 px-6">
        {/* Loved ones cards */}
        <div className="space-y-4">
          {lovedOnes.map((person) => (
            <Card
              className="p-5"
              key={person.name}
              onClick={() => navigate("/profile")}
            >
              <div className="mb-4 flex items-center gap-4">
                <Avatar
                  name={person.name}
                  relationship={person.relationship}
                  size="lg"
                  status={person.status}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1 font-semibold text-[#1A1D1F]">
                    {person.name}
                  </h3>
                  <StatusBadge status={person.status} />
                </div>
                <div className="text-right">
                  <Sparkline
                    color="#10B981"
                    data={person.sparklineData}
                    height={30}
                    width={60}
                  />
                  <p className="mt-1 text-[#9CA3AF] text-xs">Heart rate</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Today's highlights */}
        <div>
          <h2 className="mb-4 font-semibold text-[#1A1D1F] text-lg">
            {t("home.highlights")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <Card className="p-4" key={item.label}>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#003543]/5">
                    <Icon className="h-5 w-5 text-[#003543]" />
                  </div>
                  <p className="mb-1 text-[#6C7280] text-xs">{item.label}</p>
                  <p className="mb-1 font-semibold text-[#1A1D1F] text-lg">
                    {item.value}
                  </p>
                  <p
                    className={`text-xs ${item.positive ? "text-[#10B981]" : "text-[#EF4444]"}`}
                  >
                    {item.change}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Ask Zeina card */}
        <Card
          className="p-5"
          onClick={() => navigate("/zeina")}
          variant="highlight"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#EB9C0C] to-[#EB9C0C]/80 shadow-md">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 font-semibold text-[#1A1D1F]">
                {t("home.ask.zeina")}
              </h3>
              <p className="text-[#6C7280] text-sm">
                Get insights and take actions
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-[#EB9C0C]" />
          </div>
        </Card>

        {/* Latest alerts */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              {t("home.latest.alerts")}
            </h2>
            <button
              className="font-medium text-[#003543] text-sm hover:text-[#03303C]"
              onClick={() => navigate("/alerts")}
            >
              {t("home.view.all")}
            </button>
          </div>

          <div className="space-y-3">
            <AlertCard
              message="Omar's sleep quality has increased by 12% this week"
              onAction={() => navigate("/alerts")}
              severity="info"
              timestamp="2 hours ago"
              title="Sleep pattern improved"
            />
            <AlertCard
              message="Sarah's evening medication is due in 30 minutes"
              onAction={() => navigate("/alerts")}
              severity="important"
              timestamp="30 min"
              title="Medication reminder"
            />
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
