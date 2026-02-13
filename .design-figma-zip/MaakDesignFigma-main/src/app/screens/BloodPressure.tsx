import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Heart,
  Plus,
  TrendingDown,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../components/ui/Card";
import { WavyBackground } from "../components/ui/WavyBackground";

export function BloodPressure() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);

  const bpData = [
    { date: "Mon", systolic: 118, diastolic: 78 },
    { date: "Tue", systolic: 122, diastolic: 80 },
    { date: "Wed", systolic: 120, diastolic: 79 },
    { date: "Thu", systolic: 125, diastolic: 82 },
    { date: "Fri", systolic: 119, diastolic: 77 },
    { date: "Sat", systolic: 121, diastolic: 79 },
    { date: "Sun", systolic: 120, diastolic: 80 },
  ];

  const recentReadings = [
    {
      systolic: 120,
      diastolic: 80,
      pulse: 72,
      time: "2 hours ago",
      status: "normal",
      note: "Morning reading",
    },
    {
      systolic: 125,
      diastolic: 82,
      pulse: 75,
      time: "Yesterday 8:00 PM",
      status: "elevated",
      note: "After dinner",
    },
    {
      systolic: 119,
      diastolic: 77,
      pulse: 68,
      time: "Yesterday 8:00 AM",
      status: "normal",
      note: "Fasting",
    },
    {
      systolic: 130,
      diastolic: 85,
      pulse: 80,
      time: "2 days ago",
      status: "high",
      note: "After exercise",
    },
    {
      systolic: 118,
      diastolic: 78,
      pulse: 70,
      time: "3 days ago",
      status: "normal",
      note: "Relaxed",
    },
  ];

  const statusColors: { [key: string]: string } = {
    normal: "#10B981",
    elevated: "#FBBF24",
    high: "#F97316",
    critical: "#EF4444",
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      normal: "Normal",
      elevated: "Elevated",
      high: "High",
      critical: "Critical",
    };
    return labels[status] || status;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FAFB] via-[#F9FDFE] to-[#E6F7F9] pb-24">
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
                <Heart className="h-6 w-6 text-[#EB9C0C]" />
                <h1 className="font-bold text-2xl text-white">
                  Blood Pressure
                </h1>
              </div>
              <p className="text-[#003543] text-sm">
                Monitor BP readings over time
              </p>
            </div>
          </div>
        </div>
      </WavyBackground>

      <div className="space-y-6 px-6 pt-6">
        {/* Current Status */}
        <Card className="bg-gradient-to-br from-[#10B981]/10 to-[#10B981]/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-[#6C7280] text-sm">
              Latest Reading
            </h2>
            <span className="text-[#6C7280] text-xs">2 hours ago</span>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-4xl text-[#003543]">120</span>
                <span className="font-bold text-2xl text-[#003543]">/</span>
                <span className="font-bold text-4xl text-[#003543]">80</span>
              </div>
              <p className="mt-1 text-[#6C7280] text-sm">
                mmHg • Pulse: 72 bpm
              </p>
            </div>
            <div className="flex-1 text-right">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/20 px-3 py-1.5 font-medium text-[#10B981] text-sm">
                <Heart className="h-4 w-4" />
                Normal
              </span>
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">121</p>
            <p className="text-[#6C7280] text-xs">Avg Systolic</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">79</p>
            <p className="text-[#6C7280] text-xs">Avg Diastolic</p>
          </Card>
          <Card className="p-4 text-center">
            <div className="mb-1 flex items-center justify-center gap-1">
              <TrendingDown className="h-4 w-4 text-[#10B981]" />
              <p className="font-bold text-2xl text-[#10B981]">3%</p>
            </div>
            <p className="text-[#6C7280] text-xs">Improving</p>
          </Card>
        </div>

        {/* BP Trend Chart */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              Pressure Trend
            </h2>
            <button className="font-medium text-[#003543] text-sm">
              7 Days
            </button>
          </div>
          <ResponsiveContainer height={220} width="100%">
            <LineChart data={bpData}>
              <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} stroke="#6C7280" />
              <YAxis domain={[60, 140]} fontSize={12} stroke="#6C7280" />
              <Tooltip />
              <Legend />
              <Line
                dataKey="systolic"
                dot={{ fill: "#DC2626", r: 3 }}
                name="Systolic"
                stroke="#DC2626"
                strokeWidth={2.5}
                type="monotone"
              />
              <Line
                dataKey="diastolic"
                dot={{ fill: "#3B82F6", r: 3 }}
                name="Diastolic"
                stroke="#3B82F6"
                strokeWidth={2.5}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 flex items-center justify-center gap-4 text-[#6C7280] text-xs">
            <span>Normal: &lt;120/80</span>
            <span>Elevated: 120-129/&lt;80</span>
          </div>
        </Card>

        {/* Reference Ranges */}
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-[#1A1D1F] text-lg">
            Reference Ranges
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-[#10B981]/10 p-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#10B981]" />
                <span className="font-medium text-[#1A1D1F]">Normal</span>
              </div>
              <span className="text-[#6C7280] text-sm">&lt;120/80 mmHg</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#FBBF24]/10 p-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#FBBF24]" />
                <span className="font-medium text-[#1A1D1F]">Elevated</span>
              </div>
              <span className="text-[#6C7280] text-sm">
                120-129/&lt;80 mmHg
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#F97316]/10 p-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#F97316]" />
                <span className="font-medium text-[#1A1D1F]">High Stage 1</span>
              </div>
              <span className="text-[#6C7280] text-sm">130-139/80-89 mmHg</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#EF4444]/10 p-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#EF4444]" />
                <span className="font-medium text-[#1A1D1F]">High Stage 2</span>
              </div>
              <span className="text-[#6C7280] text-sm">≥140/90 mmHg</span>
            </div>
          </div>
        </Card>

        {/* Recent Readings */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              Recent Readings
            </h2>
            <button className="font-medium text-[#003543] text-sm">
              View All
            </button>
          </div>

          <div className="space-y-3">
            {recentReadings.map((reading, index) => (
              <Card
                className="cursor-pointer p-4 transition-all hover:shadow-lg"
                key={index}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${statusColors[reading.status]}15`,
                    }}
                  >
                    <Heart
                      className="h-6 w-6"
                      style={{ color: statusColors[reading.status] }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="font-semibold text-[#1A1D1F]">
                        {reading.systolic}/{reading.diastolic} mmHg
                      </h3>
                      <span
                        className="rounded-full px-2 py-1 font-medium text-xs"
                        style={{
                          backgroundColor: `${statusColors[reading.status]}15`,
                          color: statusColors[reading.status],
                        }}
                      >
                        {getStatusLabel(reading.status)}
                      </span>
                    </div>
                    <p className="mb-1 text-[#6C7280] text-sm">
                      Pulse: {reading.pulse} bpm • {reading.note}
                    </p>
                    <div className="flex items-center gap-1 text-[#6C7280] text-xs">
                      <Clock className="h-3 w-3" />
                      <span>{reading.time}</span>
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

      {/* Add Reading Modal */}
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
                  Log Blood Pressure
                </h2>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F4F6]"
                  onClick={() => setShowAddModal(false)}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                      Systolic
                    </label>
                    <input
                      className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                      placeholder="120"
                      type="number"
                    />
                    <p className="mt-1 text-[#6C7280] text-xs">mmHg</p>
                  </div>
                  <div>
                    <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                      Diastolic
                    </label>
                    <input
                      className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                      placeholder="80"
                      type="number"
                    />
                    <p className="mt-1 text-[#6C7280] text-xs">mmHg</p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Pulse Rate (Optional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    placeholder="72"
                    type="number"
                  />
                  <p className="mt-1 text-[#6C7280] text-xs">bpm</p>
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Time
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    defaultValue={new Date().toTimeString().slice(0, 5)}
                    type="time"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Notes (Optional)
                  </label>
                  <textarea
                    className="w-full resize-none rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    placeholder="e.g., After breakfast, feeling relaxed"
                    rows={2}
                  />
                </div>

                <button className="w-full rounded-xl bg-[#003543] py-4 font-semibold text-white transition-colors hover:bg-[#003543]/90">
                  Save Reading
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
