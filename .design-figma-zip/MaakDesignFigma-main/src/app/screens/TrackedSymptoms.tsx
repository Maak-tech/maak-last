import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Clock,
  Plus,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../components/ui/Card";
import { WavyBackground } from "../components/ui/WavyBackground";

export function TrackedSymptoms() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);

  const symptomData = [
    { date: "Mon", severity: 2 },
    { date: "Tue", severity: 3 },
    { date: "Wed", severity: 4 },
    { date: "Thu", severity: 3 },
    { date: "Fri", severity: 2 },
    { date: "Sat", severity: 1 },
    { date: "Sun", severity: 2 },
  ];

  const recentSymptoms = [
    {
      symptom: "Nausea",
      severity: "Medium",
      time: "2 hours ago",
      notes: "After breakfast",
      color: "#EF4444",
    },
    {
      symptom: "Headache",
      severity: "Mild",
      time: "5 hours ago",
      notes: "Frontal area",
      color: "#F97316",
    },
    {
      symptom: "Fatigue",
      severity: "High",
      time: "Yesterday",
      notes: "Throughout the day",
      color: "#DC2626",
    },
    {
      symptom: "Dizziness",
      severity: "Low",
      time: "Yesterday",
      notes: "When standing up",
      color: "#FBBF24",
    },
    {
      symptom: "Nausea",
      severity: "High",
      time: "2 days ago",
      notes: "Evening time",
      color: "#EF4444",
    },
  ];

  const severityColors: { [key: string]: string } = {
    Low: "#10B981",
    Mild: "#FBBF24",
    Medium: "#F97316",
    High: "#DC2626",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FAFB] via-[#F9FDFE] to-[#E6F7F9] pb-24">
      {/* Header with Wavy Background */}
      <WavyBackground variant="teal">
        <div className="px-6 pt-6 pb-8">
          <div className="mb-2 flex items-center gap-4">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/40 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/50"
              onClick={() => navigate("/track")}
            >
              <ArrowLeft className="h-5 w-5 text-[#003543]" />
            </button>
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Activity className="h-6 w-6 text-[#EB9C0C]" />
                <h1 className="font-bold text-2xl text-white">
                  Tracked Symptoms
                </h1>
              </div>
              <p className="text-[#003543] text-sm">
                Monitor symptoms over time
              </p>
            </div>
          </div>
        </div>
      </WavyBackground>

      <div className="space-y-6 px-6 pt-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">8</p>
            <p className="text-[#6C7280] text-xs">This Week</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#F97316]">2.8</p>
            <p className="text-[#6C7280] text-xs">Avg Severity</p>
          </Card>
          <Card className="p-4 text-center">
            <div className="mb-1 flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4 text-[#10B981]" />
              <p className="font-bold text-2xl text-[#10B981]">12%</p>
            </div>
            <p className="text-[#6C7280] text-xs">Improving</p>
          </Card>
        </div>

        {/* Severity Trend Chart */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              Severity Trend
            </h2>
            <button className="font-medium text-[#003543] text-sm">
              7 Days
            </button>
          </div>
          <ResponsiveContainer height={200} width="100%">
            <LineChart data={symptomData}>
              <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} stroke="#6C7280" />
              <YAxis domain={[0, 5]} fontSize={12} stroke="#6C7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line
                activeDot={{ r: 6 }}
                dataKey="severity"
                dot={{ fill: "#EF4444", r: 4 }}
                stroke="#EF4444"
                strokeWidth={3}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 flex items-center justify-center gap-4 text-[#6C7280] text-xs">
            <span>1 = Minimal</span>
            <span>5 = Severe</span>
          </div>
        </Card>

        {/* Common Symptoms */}
        <div>
          <h2 className="mb-4 font-semibold text-[#1A1D1F] text-lg">
            Quick Add
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {["Nausea", "Headache", "Fatigue", "Dizziness"].map((symptom) => (
              <button
                className="rounded-xl border-2 border-[#003543]/20 border-dashed p-4 font-medium text-[#003543] text-sm transition-all hover:border-[#003543]/40 hover:bg-[#003543]/5"
                key={symptom}
                onClick={() => setShowAddModal(true)}
              >
                + {symptom}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Entries */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              Recent Entries
            </h2>
            <button className="font-medium text-[#003543] text-sm">
              View All
            </button>
          </div>

          <div className="space-y-3">
            {recentSymptoms.map((entry, index) => (
              <Card
                className="cursor-pointer p-4 transition-all hover:shadow-lg"
                key={index}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${entry.color}15` }}
                  >
                    <Activity
                      className="h-6 w-6"
                      style={{ color: entry.color }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="font-semibold text-[#1A1D1F]">
                        {entry.symptom}
                      </h3>
                      <span
                        className="rounded-full px-2 py-1 font-medium text-xs"
                        style={{
                          backgroundColor: `${severityColors[entry.severity]}15`,
                          color: severityColors[entry.severity],
                        }}
                      >
                        {entry.severity}
                      </span>
                    </div>
                    <p className="mb-1 text-[#6C7280] text-sm">{entry.notes}</p>
                    <div className="flex items-center gap-1 text-[#6C7280] text-xs">
                      <Clock className="h-3 w-3" />
                      <span>{entry.time}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#6C7280]" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* FAB */}
        <div className="fixed right-6 bottom-24">
          <button
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D48A00] shadow-xl transition-all hover:scale-105 hover:bg-[#D48A00]/90"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      {/* Add Symptom Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-bold text-[#1A1D1F] text-xl">
                  Log Symptom
                </h2>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F4F6]"
                  onClick={() => setShowAddModal(false)}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Symptom Type
                  </label>
                  <select className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20">
                    <option>Nausea</option>
                    <option>Headache</option>
                    <option>Fatigue</option>
                    <option>Dizziness</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Severity Level
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {["Minimal", "Mild", "Medium", "Severe"].map(
                      (level, idx) => (
                        <button
                          className={`rounded-xl border-2 py-3 font-medium text-sm transition-all ${
                            idx === 1
                              ? "border-[#003543] bg-[#003543]/5 text-[#003543]"
                              : "border-[#E5E7EB] text-[#6C7280] hover:border-[#003543]/30"
                          }`}
                          key={level}
                        >
                          {level}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Notes (Optional)
                  </label>
                  <textarea
                    className="w-full resize-none rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    placeholder="Add any additional details..."
                    rows={3}
                  />
                </div>

                <button className="w-full rounded-xl bg-[#003543] py-4 font-semibold text-white transition-colors hover:bg-[#003543]/90">
                  Save Symptom
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
