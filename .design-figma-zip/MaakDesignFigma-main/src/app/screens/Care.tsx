import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
} from "lucide-react";
import { Avatar } from "../components/ui/Avatar";
import { BottomNav } from "../components/ui/BottomNav";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useLanguage } from "../context/LanguageContext";

export function Care() {
  const { t } = useLanguage();

  const tasks = [
    {
      id: 1,
      type: "medication",
      title: "Evening medication",
      person: "Sarah Ahmed",
      time: "Due in 30 min",
      priority: "high",
      completed: false,
    },
    {
      id: 2,
      type: "checkup",
      title: "Morning check-in",
      person: "Omar Hassan",
      time: "Completed",
      priority: "normal",
      completed: true,
    },
    {
      id: 3,
      type: "appointment",
      title: "Dr. Johnson appointment",
      person: "Sarah Ahmed",
      time: "Tomorrow at 2:30 PM",
      priority: "normal",
      completed: false,
    },
  ];

  const weeklyHighlights = [
    {
      label: "Tasks completed",
      value: "18/20",
      percentage: 90,
      color: "#10B981",
    },
    {
      label: "Medication adherence",
      value: "100%",
      percentage: 100,
      color: "#EB9C0C",
    },
    {
      label: "Check-ins done",
      value: "14/14",
      percentage: 100,
      color: "#3B82F6",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F9FDFE] pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <h1 className="mb-2 font-semibold text-3xl text-[#1A1D1F]">
          {t("nav.care")}
        </h1>
        <p className="text-[#6C7280]">Manage tasks and care activities</p>
      </div>

      <div className="space-y-6 px-6">
        {/* Weekly highlights */}
        <div>
          <h2 className="mb-4 font-semibold text-[#1A1D1F] text-lg">
            This Week
          </h2>
          <Card className="p-5">
            <div className="space-y-4">
              {weeklyHighlights.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[#6C7280] text-sm">{item.label}</span>
                    <span className="font-semibold text-[#1A1D1F] text-sm">
                      {item.value}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Tasks */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              Today's Tasks
            </h2>
            <button className="font-medium text-[#003543] text-sm">
              View all
            </button>
          </div>

          <div className="space-y-3">
            {tasks.map((task) => (
              <Card
                className={`p-4 ${task.completed ? "opacity-60" : ""}`}
                key={task.id}
              >
                <div className="flex items-start gap-3">
                  <button
                    className={`mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      task.completed
                        ? "border-[#10B981] bg-[#10B981]"
                        : "border-[#D1D5DB] hover:border-[#003543]"
                    }`}
                  >
                    {task.completed && (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h3
                        className={`font-semibold ${
                          task.completed
                            ? "text-[#9CA3AF] line-through"
                            : "text-[#1A1D1F]"
                        }`}
                      >
                        {task.title}
                      </h3>
                      {task.priority === "high" && !task.completed && (
                        <span className="rounded bg-[#EF4444]/10 px-2 py-0.5 font-medium text-[#EF4444] text-xs">
                          High
                        </span>
                      )}
                    </div>
                    <p className="mb-1 text-[#6C7280] text-sm">{task.person}</p>
                    <div className="flex items-center gap-1 text-[#9CA3AF] text-sm">
                      <Clock className="h-4 w-4" />
                      <span>{task.time}</span>
                    </div>
                  </div>

                  <Avatar name={task.person} size="sm" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Upcoming appointments */}
        <div>
          <h2 className="mb-4 font-semibold text-[#1A1D1F] text-lg">
            Upcoming Appointments
          </h2>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#003543]/5">
                <Calendar className="h-6 w-6 text-[#003543]" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[#1A1D1F]">
                  Dr. Johnson - General Checkup
                </p>
                <p className="text-[#6C7280] text-sm">
                  Tomorrow, Feb 13 • 2:30 PM
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button size="md" variant="secondary">
            <FileText className="h-5 w-5" />
            Weekly Report
          </Button>
          <Button size="md" variant="accent">
            <TrendingUp className="h-5 w-5" />
            Export Data
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
