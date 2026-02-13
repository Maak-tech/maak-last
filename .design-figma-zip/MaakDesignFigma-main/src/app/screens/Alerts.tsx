import { ArrowLeft, Filter } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { AlertCard } from "../components/ui/AlertCard";
import { BottomNav } from "../components/ui/BottomNav";
import { useLanguage } from "../context/LanguageContext";

export function Alerts() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<
    "all" | "critical" | "important" | "info"
  >("all");

  const alerts = [
    {
      id: 1,
      severity: "critical" as const,
      title: "Unusual heart rate detected",
      message: "Omar's heart rate exceeded 100 bpm for 15 minutes during rest",
      timestamp: "5 min ago",
      person: "Omar Hassan",
    },
    {
      id: 2,
      severity: "important" as const,
      title: "Medication reminder",
      message: "Sarah's evening medication is due in 30 minutes",
      timestamp: "30 min ago",
      person: "Sarah Ahmed",
    },
    {
      id: 3,
      severity: "info" as const,
      title: "Sleep pattern improved",
      message:
        "Omar's sleep quality has increased by 12% this week. Deep sleep duration up by 20 minutes.",
      timestamp: "2 hours ago",
      person: "Omar Hassan",
    },
    {
      id: 4,
      severity: "important" as const,
      title: "Activity level decreased",
      message:
        "Sarah's daily steps are 30% below her average for the past 3 days",
      timestamp: "5 hours ago",
      person: "Sarah Ahmed",
    },
    {
      id: 5,
      severity: "info" as const,
      title: "Weekly health summary ready",
      message: "Your weekly family health report is now available",
      timestamp: "1 day ago",
      person: "All",
    },
  ];

  const filteredAlerts =
    filter === "all"
      ? alerts
      : alerts.filter((alert) => alert.severity === filter);

  const filters = [
    { id: "all", label: t("alerts.filter.all") },
    { id: "critical", label: t("alerts.filter.critical") },
    { id: "important", label: t("alerts.filter.important") },
    { id: "info", label: t("alerts.filter.info") },
  ];

  return (
    <div className="min-h-screen bg-[#F9FDFE] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 border-[#E5E7EB] border-b bg-white">
        <div className="px-6 pt-12 pb-4">
          <div className="mb-6 flex items-center gap-4">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F4F6] transition-colors hover:bg-[#E5E7EB]"
              onClick={() => navigate("/home")}
            >
              <ArrowLeft className="h-5 w-5 text-[#4E5661]" />
            </button>
            <h1 className="font-semibold text-2xl text-[#1A1D1F]">
              {t("alerts.title")}
            </h1>
          </div>

          {/* Filter chips */}
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
            {filters.map(({ id, label }) => (
              <button
                className={`whitespace-nowrap rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
                  filter === id
                    ? "bg-[#003543] text-white"
                    : "bg-[#F3F4F6] text-[#4E5661] hover:bg-[#E5E7EB]"
                }`}
                key={id}
                onClick={() => setFilter(id as typeof filter)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts list */}
      <div className="space-y-4 px-6 py-6">
        {filteredAlerts.map((alert) => (
          <div key={alert.id}>
            <p className="mb-2 font-medium text-[#9CA3AF] text-xs">
              {alert.person}
            </p>
            <AlertCard
              message={alert.message}
              onAction={() => {
                /* Navigate to alert detail */
              }}
              severity={alert.severity}
              timestamp={alert.timestamp}
              title={alert.title}
            />
          </div>
        ))}

        {filteredAlerts.length === 0 && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F3F4F6]">
              <Filter className="h-8 w-8 text-[#9CA3AF]" />
            </div>
            <p className="text-[#6C7280]">No alerts in this category</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
