import { Calendar, MessageSquare, Phone, Plus, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router";
import { Avatar } from "../components/ui/Avatar";
import { BottomNav } from "../components/ui/BottomNav";
import { Card } from "../components/ui/Card";
import { Sparkline } from "../components/ui/Sparkline";
import { StatusBadge } from "../components/ui/StatusBadge";
import { WavyBackground } from "../components/ui/WavyBackground";

export function Family() {
  const navigate = useNavigate();

  const familyMembers = [
    {
      name: "Sarah Ahmed",
      relationship: "Mom",
      age: 62,
      status: "stable" as const,
      avatar: "SA",
      sparklineData: [72, 73, 71, 74, 72, 73, 75],
      lastCheckIn: "2 hours ago",
      medications: 2,
      upcomingAppointment: "Feb 15",
    },
    {
      name: "Omar Hassan",
      relationship: "Dad",
      age: 65,
      status: "monitor" as const,
      avatar: "OH",
      sparklineData: [68, 70, 72, 75, 73, 76, 78],
      lastCheckIn: "5 hours ago",
      medications: 3,
      upcomingAppointment: "Feb 13",
    },
    {
      name: "Fatima Ali",
      relationship: "Grandma",
      age: 85,
      status: "stable" as const,
      avatar: "FA",
      sparklineData: [70, 71, 70, 72, 71, 73, 72],
      lastCheckIn: "1 day ago",
      medications: 4,
      upcomingAppointment: "Feb 20",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FAFB] via-[#F9FDFE] to-[#E6F7F9] pb-24">
      {/* Header with Wavy Background */}
      <WavyBackground variant="teal">
        <div className="px-[24px] pt-[14px] pb-[2px]">
          <div className="mt-20">
            <h1 className="m-[0px] font-bold text-[#003543] text-[28px]">
              Family Circle
            </h1>
            <p className="font-bold text-[#003543]/70 text-sm">
              Manage your family circle
            </p>
          </div>
        </div>
      </WavyBackground>

      <div className="m-[0px] px-6">
        {/* Family Members */}
        {familyMembers.map((member) => (
          <Card
            className="cursor-pointer p-5 transition-all hover:shadow-lg"
            key={member.name}
            onClick={() => navigate("/profile")}
          >
            {/* Header with Avatar and Status */}
            <div className="mb-4 flex items-start gap-4">
              <Avatar
                name={member.name}
                relationship={member.relationship}
                size="lg"
                status={member.status}
              />
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 font-semibold text-[#1A1D1F] text-lg">
                  {member.name}
                </h3>
                <p className="mb-2 text-[#6C7280] text-sm">
                  {member.age} years • Last check-in {member.lastCheckIn}
                </p>
                <StatusBadge status={member.status} />
              </div>
              <div className="text-right">
                <Sparkline
                  color="#10B981"
                  data={member.sparklineData}
                  height={30}
                  width={60}
                />
                <p className="mt-1 text-[#9CA3AF] text-xs">Heart rate</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mb-4 grid grid-cols-2 gap-3 border-[#E5E7EB] border-t pt-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#10B981]/10">
                  <Calendar className="h-4 w-4 text-[#10B981]" />
                </div>
                <div>
                  <p className="text-[#6C7280] text-xs">Next Appointment</p>
                  <p className="font-semibold text-[#1A1D1F] text-sm">
                    {member.upcomingAppointment}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EB9C0C]/10">
                  <TrendingUp className="h-4 w-4 text-[#EB9C0C]" />
                </div>
                <div>
                  <p className="text-[#6C7280] text-xs">Medications</p>
                  <p className="font-semibold text-[#1A1D1F] text-sm">
                    {member.medications} daily
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#003543]/5 px-4 py-2 font-medium text-[#003543] text-sm transition-colors hover:bg-[#003543]/10">
                <Phone className="h-4 w-4" />
                Call
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#003543]/5 px-4 py-2 font-medium text-[#003543] text-sm transition-colors hover:bg-[#003543]/10">
                <MessageSquare className="h-4 w-4" />
                Message
              </button>
            </div>
          </Card>
        ))}

        {/* Add Member Card */}
        <Card className="cursor-pointer border-2 border-[#D1D5DB] border-dashed bg-[#F9FAFB] p-8 transition-all hover:shadow-lg">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#003543]/5">
              <Plus className="h-8 w-8 text-[#003543]" />
            </div>
            <h3 className="mb-1 font-semibold text-[#1A1D1F]">
              Add Family Member
            </h3>
            <p className="text-[#6C7280] text-sm">
              Invite someone to your care circle
            </p>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
