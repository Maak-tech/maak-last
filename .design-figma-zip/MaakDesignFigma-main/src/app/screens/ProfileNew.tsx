import {
  Activity,
  Heart,
  MessageSquare,
  Moon,
  Phone,
  Pill,
  Settings,
  TrendingUp,
  Watch,
} from "lucide-react";
import { useNavigate } from "react-router";
import { Avatar } from "../components/ui/Avatar";
import { BottomNav } from "../components/ui/BottomNav";
import { Card } from "../components/ui/Card";
import { Sparkline } from "../components/ui/Sparkline";

export function ProfileNew() {
  const navigate = useNavigate();

  const vitals = [
    {
      icon: Heart,
      label: "Heart Rate",
      value: "72 bpm",
      trend: "Stable",
      sparkline: [70, 71, 72, 71, 73, 72, 72],
      color: "#EF4444",
    },
    {
      icon: Moon,
      label: "Sleep",
      value: "7.5 hrs",
      trend: "+12% this week",
      sparkline: [6.5, 7, 6.8, 7.2, 7.5, 7.3, 7.5],
      color: "#3B82F6",
    },
    {
      icon: Activity,
      label: "Activity",
      value: "8,234 steps",
      trend: "+5% today",
      sparkline: [6000, 7000, 8000, 7500, 8500, 8000, 8234],
      color: "#10B981",
    },
  ];

  const medications = [
    {
      name: "Blood Pressure Medication",
      dosage: "10mg",
      time: "9:00 AM",
      status: "taken",
    },
    { name: "Aspirin", dosage: "100mg", time: "8:00 PM", status: "pending" },
  ];

  return (
    <div className="min-h-screen bg-[#F9FDFE] pb-24">
      {/* Simple Header */}
      <div className="border-[#E5E7EB] border-b bg-white px-6 pt-12 pb-8">
        <div className="relative text-center">
          <button className="absolute top-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] transition-colors hover:bg-[#E5E7EB]">
            <Settings className="h-5 w-5 text-[#1A1D1F]" />
          </button>

          <Avatar
            className="mb-4"
            imageUrl="https://images.unsplash.com/photo-1655249493799-9cee4fe983bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbiUyMHBvcnRyYWl0JTIwaGVhZHNob3R8ZW58MXx8fHwxNzcwOTI1OTIyfDA&ixlib=rb-4.1.0&q=80&w=1080"
            name="Mira Ahmed"
            size="xl"
          />
          <h1 className="mb-1 font-bold text-[#1A1D1F] text-[32px]">
            Mira Ahmed
          </h1>
          <p className="mb-4 text-[#6C7280]">Primary Caregiver</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="-mt-8 mb-6 px-6">
        <Card className="p-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="mb-1 font-bold text-2xl text-[#003543]">3</p>
              <p className="text-[#6C7280] text-xs">Family Members</p>
            </div>
            <div className="text-center">
              <p className="mb-1 font-bold text-2xl text-[#003543]">12</p>
              <p className="text-[#6C7280] text-xs">Active Tasks</p>
            </div>
            <div className="text-center">
              <p className="mb-1 font-bold text-2xl text-[#003543]">100%</p>
              <p className="text-[#6C7280] text-xs">This Week</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="-mt-10 mb-6 px-6">
        <div className="grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-4 transition-all hover:border-[#003543]/20 hover:shadow-md">
            <Phone className="h-5 w-5 text-[#10B981]" />
            <span className="font-medium text-[#1A1D1F]">
              Emergency Contact
            </span>
          </button>
          <button className="flex items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-4 transition-all hover:border-[#003543]/20 hover:shadow-md">
            <MessageSquare className="h-5 w-5 text-[#3B82F6]" />
            <span className="font-medium text-[#1A1D1F]">Care Team</span>
          </button>
        </div>
      </div>

      <div className="space-y-6 px-6">
        {/* Health Overview */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold font-semibold text-[#003543] text-lg">
              Health Overview
            </h2>
            <button
              className="font-medium text-[#003543] text-sm hover:text-[#03303C]"
              onClick={() => navigate("/trends")}
            >
              View Details →
            </button>
          </div>
          <div className="space-y-3">
            {vitals.map((vital) => {
              const Icon = vital.icon;
              return (
                <Card className="p-4" key={vital.label}>
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${vital.color}15` }}
                    >
                      <Icon
                        className="h-6 w-6"
                        style={{ color: vital.color }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[#6C7280] text-sm">
                        {vital.label}
                      </p>
                      <p className="font-semibold text-[#1A1D1F] text-xl">
                        {vital.value}
                      </p>
                    </div>
                    <div className="text-right">
                      <Sparkline
                        color={vital.color}
                        data={vital.sparkline}
                        height={30}
                        width={60}
                      />
                      <p className="mt-1 text-[#10B981] text-xs">
                        {vital.trend}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Today's Medications */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold font-semibold text-[#003543] text-lg">
              Today's Medications
            </h2>
            <button
              className="font-medium text-[#003543] text-sm hover:text-[#03303C]"
              onClick={() => navigate("/track")}
            >
              View All →
            </button>
          </div>
          <Card className="divide-y divide-[#E5E7EB]">
            {medications.map((med, index) => (
              <div className="flex items-center gap-3 p-4" key={index}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#10B981]/10">
                  <Pill className="h-5 w-5 text-[#10B981]" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#1A1D1F]">{med.name}</p>
                  <p className="text-[#6C7280] text-sm">
                    {med.dosage} • {med.time}
                  </p>
                </div>
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    med.status === "taken"
                      ? "border-[#10B981] bg-[#10B981]"
                      : "border-[#D1D5DB]"
                  }`}
                >
                  {med.status === "taken" && (
                    <svg
                      className="h-4 w-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Account Settings */}
        <div>
          <h2 className="mb-4 font-bold font-semibold text-[#003543] text-lg">
            Account
          </h2>
          <Card className="divide-y divide-[#E5E7EB]">
            {[
              { label: "Personal Information", icon: Settings },
              { label: "Notifications", icon: Activity },
              { label: "Privacy & Security", icon: Watch },
              { label: "Connected Devices", icon: Watch },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  className="flex w-full items-center gap-3 p-4 transition-colors hover:bg-[#F9FAFB]"
                  key={index}
                  onClick={() => navigate("/settings")}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#003543]/5">
                    <Icon className="h-5 w-5 text-[#003543]" />
                  </div>
                  <p className="flex-1 text-left font-medium text-[#1A1D1F]">
                    {item.label}
                  </p>
                  <TrendingUp className="h-5 w-5 rotate-90 text-[#9CA3AF]" />
                </button>
              );
            })}
          </Card>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
