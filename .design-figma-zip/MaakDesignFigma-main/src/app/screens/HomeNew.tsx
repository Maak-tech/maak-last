import {
  Activity,
  ChevronRight,
  MoreVertical,
  Phone,
  Pill,
} from "lucide-react";
import { useNavigate } from "react-router";
import { BottomNav } from "../components/ui/BottomNav";
import { Card } from "../components/ui/Card";
import { WavyBackground } from "../components/ui/WavyBackground";

export function HomeNew() {
  const navigate = useNavigate();

  const medications = [
    {
      name: "Ibuprofen",
      dosage: "400mg",
      frequency: "once",
      nextTime: "02:47",
    },
  ];

  const symptoms = [
    {
      name: "Nausea",
      date: "Jan 26, 2026",
      time: "1:22 PM",
      severity: "medium",
    },
    {
      name: "Insomnia",
      date: "Dec 23, 2025",
      time: "8:12 PM",
      severity: "high",
    },
    { name: "Fever", date: "Dec 15, 2025", time: "3:45 PM", severity: "low" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FAFB] via-[#F9FDFE] to-[#E6F7F9] pb-24">
      {/* Header with Wavy Background */}
      <WavyBackground variant="teal">
        <div className="pt-[24px] pr-[10px] pb-[16px] pl-[24px]">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="font-bold text-[32px] text-white">Welcome, Mira</h1>

            <div className="flex items-center gap-3">
              {/* SOS Button */}
              <button className="flex items-center gap-2 rounded-full bg-[#EF4444] px-4 py-2 shadow-lg transition-colors hover:bg-[#DC2626]">
                <Phone className="h-4 w-4 text-white" />
                <span className="font-bold text-sm text-white">SOS</span>
              </button>

              {/* Notification badge */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EB9C0C] shadow-lg">
                <span className="font-bold text-sm text-white">54</span>
              </div>
            </div>
          </div>

          <div className="mt-20">
            <p className="m-[0px] p-[0px] font-bold text-[#003543] text-sm">
              Thursday, February 12, 2026
            </p>
          </div>
        </div>
      </WavyBackground>

      {/* Stats Cards */}
      <div className="px-[24px] py-[0px]">
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-5 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center">
              <Activity className="h-8 w-8 text-[#003543]" />
            </div>
            <p className="mb-2 font-bold text-4xl text-[#EB9C0C]">0</p>
            <p className="text-[#6C7280] text-sm">Symptoms This Week</p>
          </Card>

          <Card className="p-5 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center">
              <Pill className="h-8 w-8 text-[#10B981]" />
            </div>
            <p className="mb-2 font-bold text-4xl text-[#EB9C0C]">0%</p>
            <p className="text-[#6C7280] text-sm">Med Compliance</p>
          </Card>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6 px-6 pt-6">
        {/* Today's Medications */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold font-semibold text-[#003543] text-xl">
              Today's Medications
            </h2>
            <button
              className="flex items-center gap-1 font-medium text-[#003543] text-sm hover:text-[#03303C]"
              onClick={() => navigate("/track")}
            >
              View All
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Card className="p-5">
            {medications.map((med, index) => (
              <div className="flex items-center gap-4" key={index}>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#003543]/5">
                  <Pill className="h-6 w-6 text-[#003543]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1 font-semibold text-[#1A1D1F]">
                    {med.name}
                  </h3>
                  <p className="text-[#6C7280] text-sm">
                    {med.dosage} • {med.frequency} • Next: {med.nextTime}
                  </p>
                </div>
                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#003543] transition-colors hover:bg-[#03303C]">
                  <Pill className="h-5 w-5 text-white" />
                </button>
              </div>
            ))}
          </Card>
        </div>

        {/* Recent Symptoms */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold font-semibold text-[#003543] text-xl">
              Recent Symptoms
            </h2>
            <button
              className="flex items-center gap-1 font-medium text-[#003543] text-sm hover:text-[#03303C]"
              onClick={() => navigate("/track")}
            >
              View All
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Card className="divide-y divide-[#E5E7EB]">
            {symptoms.map((symptom, index) => {
              const severityColors = {
                low: "#10B981",
                medium: "#F59E0B",
                high: "#EF4444",
              };
              const severityDots = {
                low: 1,
                medium: 2,
                high: 3,
              };

              return (
                <div
                  className="flex items-center justify-between p-4"
                  key={index}
                >
                  <div className="flex-1">
                    <h3 className="mb-1 font-semibold text-[#1A1D1F]">
                      {symptom.name}
                    </h3>
                    <p className="text-[#6C7280] text-sm">
                      {symptom.date} • {symptom.time}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(4)].map((_, i) => (
                      <div
                        className="h-2 w-2 rounded-full"
                        key={i}
                        style={{
                          backgroundColor:
                            i < severityDots[symptom.severity]
                              ? severityColors[symptom.severity]
                              : "#E5E7EB",
                        }}
                      />
                    ))}
                  </div>
                  <button className="ml-3 text-[#9CA3AF] hover:text-[#6C7280]">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
              );
            })}
          </Card>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
