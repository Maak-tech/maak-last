import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Heart,
  Plus,
  Stethoscope,
  Thermometer,
  Wind,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../components/ui/Card";
import { WavyBackground } from "../components/ui/WavyBackground";

export function VitalSigns() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVital, setSelectedVital] = useState("temperature");

  const vitalCategories = [
    {
      id: "temperature",
      icon: Thermometer,
      label: "Temperature",
      value: "98.6°F",
      status: "normal",
      color: "#F97316",
    },
    {
      id: "heartrate",
      icon: Heart,
      label: "Heart Rate",
      value: "72 bpm",
      status: "normal",
      color: "#DC2626",
    },
    {
      id: "oxygen",
      icon: Wind,
      label: "Oxygen Sat",
      value: "98%",
      status: "normal",
      color: "#3B82F6",
    },
    {
      id: "respiratory",
      icon: Activity,
      label: "Resp. Rate",
      value: "16/min",
      status: "normal",
      color: "#10B981",
    },
  ];

  const recentReadings = [
    {
      type: "Temperature",
      value: "98.6°F",
      time: "2 hours ago",
      status: "normal",
      icon: Thermometer,
      color: "#F97316",
      note: "Oral reading",
    },
    {
      type: "Heart Rate",
      value: "72 bpm",
      time: "2 hours ago",
      status: "normal",
      icon: Heart,
      color: "#DC2626",
      note: "Resting",
    },
    {
      type: "Oxygen Saturation",
      value: "98%",
      time: "3 hours ago",
      status: "normal",
      icon: Wind,
      color: "#3B82F6",
      note: "Finger pulse oximeter",
    },
    {
      type: "Temperature",
      value: "99.1°F",
      time: "Yesterday",
      status: "elevated",
      icon: Thermometer,
      color: "#F97316",
      note: "Evening reading",
    },
    {
      type: "Respiratory Rate",
      value: "16/min",
      time: "Yesterday",
      status: "normal",
      icon: Activity,
      color: "#10B981",
      note: "Resting",
    },
  ];

  const statusColors: { [key: string]: string } = {
    normal: "#10B981",
    elevated: "#FBBF24",
    high: "#F97316",
    low: "#3B82F6",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FAFB] via-[#F9FDFE] to-[#E6F7F9] pb-24">
      <WavyBackground variant="teal">
        <div className="px-[24px] pt-[24px] pb-[10px]">
          <div className="mb-2 flex items-center gap-4">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/40 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/50"
              onClick={() => navigate("/track")}
            >
              <ArrowLeft className="h-5 w-5 text-[#003543]" />
            </button>
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Stethoscope className="h-6 w-6 text-[#EB9C0C]" />
                <h1 className="-mt-2 font-bold text-2xl text-white">
                  Vital Signs
                </h1>
              </div>
              <p className="text-[#003543] text-sm">
                Monitor essential health metrics
              </p>
            </div>
          </div>
        </div>
      </WavyBackground>

      <div className="space-y-6 px-6 pt-6">
        {/* Current Vitals Grid */}
        <div>
          <h2 className="mb-4 font-semibold text-[#1A1D1F] text-lg">
            Current Vitals
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {vitalCategories.map((vital) => {
              const Icon = vital.icon;
              return (
                <Card
                  className="cursor-pointer p-4 transition-all hover:shadow-lg"
                  key={vital.id}
                  onClick={() => {
                    setSelectedVital(vital.id);
                    setShowAddModal(true);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${vital.color}15` }}
                    >
                      <Icon
                        className="h-6 w-6"
                        style={{ color: vital.color }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="mb-1 text-[#6C7280] text-xs">
                        {vital.label}
                      </p>
                      <p className="mb-1 font-bold text-[#003543] text-xl">
                        {vital.value}
                      </p>
                      <span
                        className="inline-block rounded-full px-2 py-0.5 font-medium text-xs"
                        style={{
                          backgroundColor: `${statusColors[vital.status]}15`,
                          color: statusColors[vital.status],
                        }}
                      >
                        {vital.status}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">24</p>
            <p className="text-[#6C7280] text-xs">Readings</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#10B981]">95%</p>
            <p className="text-[#6C7280] text-xs">Normal</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">7d</p>
            <p className="text-[#6C7280] text-xs">Tracked</p>
          </Card>
        </div>

        {/* Reference Ranges */}
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-[#1A1D1F] text-lg">
            Normal Ranges
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between border-[#E5E7EB] border-b py-2">
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-[#F97316]" />
                <span className="text-[#1A1D1F] text-sm">Temperature</span>
              </div>
              <span className="text-[#6C7280] text-sm">97.8-99.1°F</span>
            </div>
            <div className="flex items-center justify-between border-[#E5E7EB] border-b py-2">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-[#DC2626]" />
                <span className="text-[#1A1D1F] text-sm">Heart Rate</span>
              </div>
              <span className="text-[#6C7280] text-sm">60-100 bpm</span>
            </div>
            <div className="flex items-center justify-between border-[#E5E7EB] border-b py-2">
              <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 text-[#3B82F6]" />
                <span className="text-[#1A1D1F] text-sm">
                  Oxygen Saturation
                </span>
              </div>
              <span className="text-[#6C7280] text-sm">95-100%</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#10B981]" />
                <span className="text-[#1A1D1F] text-sm">Respiratory Rate</span>
              </div>
              <span className="text-[#6C7280] text-sm">12-20/min</span>
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
            {recentReadings.map((reading, index) => {
              const Icon = reading.icon;
              return (
                <Card
                  className="cursor-pointer p-4 transition-all hover:shadow-lg"
                  key={index}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${reading.color}15` }}
                    >
                      <Icon
                        className="h-6 w-6"
                        style={{ color: reading.color }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <h3 className="font-semibold text-[#1A1D1F]">
                          {reading.type}
                        </h3>
                        <span
                          className="rounded-full px-2 py-1 font-medium text-xs"
                          style={{
                            backgroundColor: `${statusColors[reading.status]}15`,
                            color: statusColors[reading.status],
                          }}
                        >
                          {reading.status}
                        </span>
                      </div>
                      <p className="mb-1 font-bold text-[#003543] text-lg">
                        {reading.value}
                      </p>
                      <p className="text-[#6C7280] text-xs">
                        {reading.time} • {reading.note}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[#6C7280]" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* FAB */}
        <div className="fixed right-6 bottom-24">
          <button
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EB9C0C] shadow-xl transition-all hover:scale-105 hover:bg-[#EB9C0C]/90"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      {/* Add Vital Sign Modal */}
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
                  Log Vital Sign
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
                    Vital Type
                  </label>
                  <select
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    onChange={(e) => setSelectedVital(e.target.value)}
                    value={selectedVital}
                  >
                    <option value="temperature">Temperature</option>
                    <option value="heartrate">Heart Rate</option>
                    <option value="oxygen">Oxygen Saturation</option>
                    <option value="respiratory">Respiratory Rate</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Value
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                      placeholder={
                        selectedVital === "temperature"
                          ? "98.6"
                          : selectedVital === "oxygen"
                            ? "98"
                            : "72"
                      }
                      step="0.1"
                      type="number"
                    />
                    <span className="w-16 text-[#6C7280] text-sm">
                      {selectedVital === "temperature"
                        ? "°F"
                        : selectedVital === "oxygen"
                          ? "%"
                          : selectedVital === "heartrate"
                            ? "bpm"
                            : "/min"}
                    </span>
                  </div>
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
                    placeholder="e.g., Oral reading, resting state"
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
