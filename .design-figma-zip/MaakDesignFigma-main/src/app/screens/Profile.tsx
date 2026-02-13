import {
  Activity,
  ArrowLeft,
  FileText,
  Heart,
  MessageSquare,
  Moon,
  Phone,
  Pill,
  Share2,
  Watch,
} from "lucide-react";
import { useNavigate } from "react-router";
import { Avatar } from "../components/ui/Avatar";
import { BottomNav } from "../components/ui/BottomNav";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Sparkline } from "../components/ui/Sparkline";
import { StatusBadge } from "../components/ui/StatusBadge";
import { WavyBackground } from "../components/ui/WavyBackground";

export function Profile() {
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

  const devices = [
    { name: "Apple Watch Series 8", status: "Connected", battery: "85%" },
    { name: "iPhone Health", status: "Synced 5m ago", battery: null },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FAFB] via-[#F9FDFE] to-[#E6F7F9] pb-24">
      {/* Header with Wavy Background */}
      <WavyBackground variant="teal">
        <div className="relative overflow-hidden rounded-b-3xl px-6 pt-12 pb-10">
          <button
            className="relative z-10 mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
            onClick={() => navigate("/home")}
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>

          <div className="relative z-10 mt-12 mb-6 flex items-start gap-4">
            <Avatar name="Omar Hassan" size="xl" status="monitor" />
            <div className="flex-1 pt-2">
              <h1 className="mb-1 font-semibold text-2xl text-[#003543]">
                Omar Hassan
              </h1>
              <p className="mb-3 text-[#003543]/70">Dad • 65 years</p>
              <StatusBadge status="monitor" />
            </div>
          </div>

          {/* Status explanation */}
          <div className="relative z-10 rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-sm text-white/90 leading-relaxed">
              <strong>Monitor:</strong> Sleep pattern has shifted compared to
              usual. Activity levels are 30% below weekly average. Continue
              monitoring for next 2-3 days.
            </p>
          </div>
        </div>
      </WavyBackground>

      {/* Quick actions */}
      <div className="-mt-6 mb-6 px-6">
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: Phone, label: "Call", color: "#10B981" },
            { icon: MessageSquare, label: "Message", color: "#3B82F6" },
            { icon: Share2, label: "Share", color: "#6C7280" },
            { icon: FileText, label: "Report", color: "#EB9C0C" },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                className="flex flex-col items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white p-4 transition-all hover:border-[#003543]/20 hover:shadow-md"
                key={action.label}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${action.color}15` }}
                >
                  <Icon className="h-6 w-6" style={{ color: action.color }} />
                </div>
                <span className="font-medium text-[#4E5661] text-xs">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-6 px-6">
        {/* Key vitals */}
        <div>
          <h2 className="mb-4 font-semibold text-[#1A1D1F] text-lg">
            Key Vitals
          </h2>
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
                      <p className="mb-1 font-semibold text-[#1A1D1F] text-xl">
                        {vital.value}
                      </p>
                      <p className="text-[#10B981] text-xs">{vital.trend}</p>
                    </div>
                    <div className="text-right">
                      <Sparkline
                        color={vital.color}
                        data={vital.sparkline}
                        height={40}
                        width={80}
                      />
                      <button
                        className="mt-2 text-[#003543] text-xs hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/trends");
                        }}
                      >
                        View details →
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Medications */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              Medications
            </h2>
            <button className="font-medium text-[#003543] text-sm">
              View all
            </button>
          </div>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EB9C0C]/10">
                <Pill className="h-5 w-5 text-[#EB9C0C]" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[#1A1D1F]">
                  Blood Pressure Medication
                </p>
                <p className="text-[#6C7280] text-sm">
                  10mg • Daily at 9:00 AM
                </p>
              </div>
              <div className="h-2 w-2 rounded-full bg-[#10B981]" />
            </div>
          </Card>
        </div>

        {/* Connected devices */}
        <div>
          <h2 className="mb-4 font-semibold text-[#1A1D1F] text-lg">
            Connected Devices
          </h2>
          <div className="space-y-3">
            {devices.map((device) => (
              <Card className="p-4" key={device.name}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#003543]/5">
                    <Watch className="h-5 w-5 text-[#003543]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[#1A1D1F]">{device.name}</p>
                    <p className="text-[#10B981] text-sm">{device.status}</p>
                  </div>
                  {device.battery && (
                    <p className="text-[#6C7280] text-sm">{device.battery}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Generate summary */}
        <Button fullWidth size="lg" variant="accent">
          <FileText className="h-5 w-5" />
          Generate Weekly Summary
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}
