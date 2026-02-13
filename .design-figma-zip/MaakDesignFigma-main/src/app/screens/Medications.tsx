import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Pill,
  Plus,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../components/ui/Card";
import { WavyBackground } from "../components/ui/WavyBackground";

export function Medications() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);

  const activeMedications = [
    {
      name: "Lisinopril",
      dosage: "10mg",
      frequency: "Once daily",
      time: "8:00 AM",
      color: "#3B82F6",
      takenToday: true,
      nextDose: "Tomorrow at 8:00 AM",
    },
    {
      name: "Metformin",
      dosage: "500mg",
      frequency: "Twice daily",
      time: "8:00 AM, 8:00 PM",
      color: "#10B981",
      takenToday: true,
      nextDose: "Today at 8:00 PM",
    },
    {
      name: "Atorvastatin",
      dosage: "20mg",
      frequency: "Once daily",
      time: "10:00 PM",
      color: "#8B5CF6",
      takenToday: false,
      nextDose: "Today at 10:00 PM",
    },
  ];

  const recentHistory = [
    {
      medication: "Lisinopril",
      dosage: "10mg",
      time: "2 hours ago",
      status: "taken",
      color: "#3B82F6",
    },
    {
      medication: "Metformin",
      dosage: "500mg",
      time: "2 hours ago",
      status: "taken",
      color: "#10B981",
    },
    {
      medication: "Ibuprofen",
      dosage: "400mg",
      time: "4 hours ago",
      status: "taken",
      color: "#F97316",
    },
    {
      medication: "Atorvastatin",
      dosage: "20mg",
      time: "Yesterday 10:00 PM",
      status: "taken",
      color: "#8B5CF6",
    },
    {
      medication: "Metformin",
      dosage: "500mg",
      time: "Yesterday 8:00 PM",
      status: "missed",
      color: "#10B981",
    },
  ];

  const upcomingDoses = [
    {
      medication: "Metformin",
      dosage: "500mg",
      time: "8:00 PM",
      in: "6 hours",
      color: "#10B981",
    },
    {
      medication: "Atorvastatin",
      dosage: "20mg",
      time: "10:00 PM",
      in: "8 hours",
      color: "#8B5CF6",
    },
    {
      medication: "Lisinopril",
      dosage: "10mg",
      time: "Tomorrow 8:00 AM",
      in: "22 hours",
      color: "#3B82F6",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FAFB] via-[#F9FDFE] to-[#E6F7F9] pb-24">
      {/* Header with Wavy Background */}
      <WavyBackground variant="teal">
        <div className="px-[24px] pt-[24px] pb-[15px]">
          <div className="mb-2 flex items-center gap-4">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/40 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/50"
              onClick={() => navigate("/track")}
            >
              <ArrowLeft className="h-5 w-5 text-[#003543]" />
            </button>
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Pill className="h-6 w-6 text-[#EB9C0C]" />
                <h1 className="font-bold text-2xl text-white">Medications</h1>
              </div>
              <p className="mx-[0px] my-[6px] px-[0px] py-[7px] text-[#003543] text-sm">
                Manage medication schedule
              </p>
            </div>
          </div>
        </div>
      </WavyBackground>

      <div className="space-y-6 px-6 pt-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">3</p>
            <p className="text-[#6C7280] text-xs">Active Meds</p>
          </Card>
          <Card className="p-4 text-center">
            <div className="mb-1 flex items-center justify-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
              <p className="font-bold text-2xl text-[#10B981]">95%</p>
            </div>
            <p className="text-[#6C7280] text-xs">Adherence</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">2</p>
            <p className="text-[#6C7280] text-xs">Due Today</p>
          </Card>
        </div>

        {/* Active Medications */}
        <div>
          <h2 className="mb-4 font-semibold text-[#1A1D1F] text-lg">
            Active Medications
          </h2>
          <div className="space-y-3">
            {activeMedications.map((med, index) => (
              <Card
                className="cursor-pointer p-4 transition-all hover:shadow-lg"
                key={index}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${med.color}15` }}
                  >
                    <Pill className="h-6 w-6" style={{ color: med.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="font-semibold text-[#1A1D1F]">
                        {med.name}
                      </h3>
                      {med.takenToday ? (
                        <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-[#F97316]" />
                      )}
                    </div>
                    <p className="mb-2 text-[#6C7280] text-sm">
                      {med.dosage} • {med.frequency}
                    </p>
                    <div className="flex items-center gap-1 text-[#6C7280] text-xs">
                      <Clock className="h-3 w-3" />
                      <span>{med.nextDose}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#6C7280]" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Upcoming Doses */}
        <div>
          <h2 className="mb-4 font-semibold text-[#1A1D1F] text-lg">
            Upcoming Doses
          </h2>
          <div className="space-y-3">
            {upcomingDoses.map((dose, index) => (
              <Card className="p-4" key={index}>
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${dose.color}15` }}
                  >
                    <Bell className="h-5 w-5" style={{ color: dose.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1 font-semibold text-[#1A1D1F] text-sm">
                      {dose.medication} {dose.dosage}
                    </h3>
                    <p className="text-[#6C7280] text-xs">
                      {dose.time} • in {dose.in}
                    </p>
                  </div>
                  <button className="rounded-lg bg-[#003543]/10 px-4 py-2 font-medium text-[#003543] text-sm transition-colors hover:bg-[#003543]/20">
                    Mark Taken
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent History */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              Recent History
            </h2>
            <button className="font-medium text-[#003543] text-sm">
              View All
            </button>
          </div>

          <div className="space-y-3">
            {recentHistory.map((entry, index) => (
              <Card className="p-4" key={index}>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${entry.color}15` }}
                  >
                    {entry.status === "taken" ? (
                      <CheckCircle2
                        className="h-5 w-5"
                        style={{ color: entry.color }}
                      />
                    ) : (
                      <XCircle className="h-5 w-5 text-[#EF4444]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-[#1A1D1F] text-sm">
                      {entry.medication} {entry.dosage}
                    </h3>
                    <p className="text-[#6C7280] text-xs">{entry.time}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 font-medium text-xs ${
                      entry.status === "taken"
                        ? "bg-[#10B981]/10 text-[#10B981]"
                        : "bg-[#EF4444]/10 text-[#EF4444]"
                    }`}
                  >
                    {entry.status === "taken" ? "Taken" : "Missed"}
                  </span>
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

      {/* Add Medication Modal */}
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
                  Add Medication
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
                    Medication Name
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    placeholder="e.g., Aspirin"
                    type="text"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                      Dosage
                    </label>
                    <input
                      className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                      placeholder="e.g., 10mg"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                      Frequency
                    </label>
                    <select className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20">
                      <option>Once daily</option>
                      <option>Twice daily</option>
                      <option>Three times daily</option>
                      <option>As needed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Time(s)
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    type="time"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Reminder
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      className="h-5 w-5 text-[#003543]"
                      defaultChecked
                      id="reminder"
                      type="checkbox"
                    />
                    <label
                      className="text-[#6C7280] text-sm"
                      htmlFor="reminder"
                    >
                      Send me a notification
                    </label>
                  </div>
                </div>

                <button className="w-full rounded-xl bg-[#003543] py-4 font-semibold text-white transition-colors hover:bg-[#003543]/90">
                  Add Medication
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
