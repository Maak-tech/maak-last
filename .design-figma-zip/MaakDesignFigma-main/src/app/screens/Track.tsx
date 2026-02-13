import {
  Activity,
  AlertCircle,
  Brain,
  Clock,
  Droplet,
  FileText,
  Heart,
  Pill,
  Plus,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router";
import { BottomNav } from "../components/ui/BottomNav";
import { Card } from "../components/ui/Card";
import { WavyBackground } from "../components/ui/WavyBackground";

export function Track() {
  const navigate = useNavigate();

  const trackingCategories = [
    {
      icon: Activity,
      label: "Tracked Symptoms",
      color: "#EF4444",
      description: "Log symptoms and severity",
      path: "/track/symptoms",
    },
    {
      icon: Pill,
      label: "Medications",
      color: "#10B981",
      description: "Track medication intake",
      path: "/track/medications",
    },
    {
      icon: Brain,
      label: "Mood",
      color: "#8B5CF6",
      description: "Record emotional state",
      path: "/mood",
    },
    {
      icon: AlertCircle,
      label: "Allergies",
      color: "#F97316",
      description: "Manage allergy info",
      path: "/allergies",
    },
    {
      icon: Heart,
      label: "Blood Pressure",
      color: "#DC2626",
      description: "Monitor BP readings",
      path: "/blood-pressure",
    },
    {
      icon: Stethoscope,
      label: "Vital Signs",
      color: "#3B82F6",
      description: "Record vital measurements",
      path: "/vital-signs",
    },
    {
      icon: FileText,
      label: "Medical History",
      color: "#6366F1",
      description: "Document medical records",
      path: "/medical-history",
    },
    {
      icon: TrendingUp,
      label: "Vitals Monitor",
      color: "#14B8A6",
      description: "Real-time vital tracking",
      path: null,
    },
    {
      icon: Clock,
      label: "Health Timeline",
      color: "#EC4899",
      description: "View health journey",
      path: null,
    },
    {
      icon: Droplet,
      label: "Lab Results",
      color: "#0EA5E9",
      description: "Store test results",
      path: "/lab-results",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FAFB] via-[#F9FDFE] to-[#E6F7F9] pb-24">
      {/* Header with Wavy Background */}
      <WavyBackground variant="teal">
        <div className="px-[24px] pt-[14px] pb-[20px]">
          <div>
            <h1 className="mx-[0px] mt-[1px] mb-[10px] px-[0px] pt-[2px] pb-[10px] font-bold text-[28px] text-white">
              Track Health
            </h1>
            <p className="px-[0px] py-[7px] font-bold text-[#003543] text-sm">
              Comprehensive health tracking
            </p>
          </div>
        </div>
      </WavyBackground>

      <div className="px-[24px] pt-[0px] pb-[32px]">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">12</p>
            <p className="text-[#6C7280] text-xs">Entries Today</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">8</p>
            <p className="text-[#6C7280] text-xs">Categories</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">95%</p>
            <p className="text-[#6C7280] text-xs">Compliance</p>
          </Card>
        </div>

        {/* Tracking Categories */}
        <div>
          <h2 className="mb-4 font-bold font-semibold text-[#003543] text-lg">
            Tracking Categories
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {trackingCategories.map((category, index) => {
              const Icon = category.icon;
              return (
                <Card
                  className="cursor-pointer p-4 transition-all hover:shadow-lg"
                  key={index}
                  onClick={() => category.path && navigate(category.path)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${category.color}15` }}
                    >
                      <Icon
                        className="h-6 w-6"
                        style={{ color: category.color }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-1 font-semibold text-[#1A1D1F] text-sm">
                        {category.label}
                      </h3>
                      <p className="line-clamp-2 text-[#6C7280] text-xs">
                        {category.description}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#003543] text-lg">
              Recent Activity
            </h2>
            <button className="font-medium text-[#003543] text-sm">
              View All
            </button>
          </div>

          <div className="space-y-3">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EF4444]/10">
                  <Activity className="h-5 w-5 text-[#EF4444]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#1A1D1F] text-sm">
                    Nausea logged
                  </p>
                  <p className="text-[#6C7280] text-xs">
                    2 hours ago • Medium severity
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#10B981]/10">
                  <Pill className="h-5 w-5 text-[#10B981]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#1A1D1F] text-sm">
                    Ibuprofen taken
                  </p>
                  <p className="text-[#6C7280] text-xs">4 hours ago • 400mg</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DC2626]/10">
                  <Heart className="h-5 w-5 text-[#DC2626]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#1A1D1F] text-sm">
                    Blood Pressure recorded
                  </p>
                  <p className="text-[#6C7280] text-xs">
                    8 hours ago • 120/80 mmHg
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8B5CF6]/10">
                  <Brain className="h-5 w-5 text-[#8B5CF6]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#1A1D1F] text-sm">
                    Mood updated
                  </p>
                  <p className="text-[#6C7280] text-xs">
                    Yesterday • Calm & positive
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* FAB */}
        <div className="fixed right-6 bottom-24">
          <button className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D48A00] shadow-xl transition-all hover:scale-105 hover:bg-[#D48A00]/90">
            <Plus className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
