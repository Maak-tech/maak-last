import { ArrowLeft, Brain, ChevronRight, Plus, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../components/ui/Card";
import { WavyBackground } from "../components/ui/WavyBackground";

export function Mood() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);

  const moodData = [
    { date: "Mon", mood: 4 },
    { date: "Tue", mood: 3 },
    { date: "Wed", mood: 5 },
    { date: "Thu", mood: 4 },
    { date: "Fri", mood: 5 },
    { date: "Sat", mood: 4 },
    { date: "Sun", mood: 4 },
  ];

  const moodDistribution = [
    { name: "Great", value: 35, color: "#10B981" },
    { name: "Good", value: 30, color: "#3B82F6" },
    { name: "Neutral", value: 20, color: "#FBBF24" },
    { name: "Low", value: 10, color: "#F97316" },
    { name: "Bad", value: 5, color: "#EF4444" },
  ];

  const recentEntries = [
    {
      mood: "Great",
      emoji: "😊",
      activities: ["Exercise", "Family time"],
      time: "2 hours ago",
      score: 5,
      color: "#10B981",
    },
    {
      mood: "Good",
      emoji: "🙂",
      activities: ["Reading", "Meditation"],
      time: "Yesterday",
      score: 4,
      color: "#3B82F6",
    },
    {
      mood: "Neutral",
      emoji: "😐",
      activities: ["Work", "Routine"],
      time: "2 days ago",
      score: 3,
      color: "#FBBF24",
    },
    {
      mood: "Good",
      emoji: "🙂",
      activities: ["Social time"],
      time: "3 days ago",
      score: 4,
      color: "#3B82F6",
    },
  ];

  const moodOptions = [
    { label: "Great", emoji: "😊", color: "#10B981", score: 5 },
    { label: "Good", emoji: "🙂", color: "#3B82F6", score: 4 },
    { label: "Neutral", emoji: "😐", color: "#FBBF24", score: 3 },
    { label: "Low", emoji: "🙁", color: "#F97316", score: 2 },
    { label: "Bad", emoji: "😢", color: "#EF4444", score: 1 },
  ];

  const activities = [
    "Exercise",
    "Work",
    "Social",
    "Family",
    "Rest",
    "Meditation",
    "Hobbies",
    "Outdoors",
  ];

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
                <Brain className="h-6 w-6 text-[#EB9C0C]" />
                <h1 className="font-bold text-2xl text-white">Mood Tracking</h1>
              </div>
              <p className="text-[#003543] text-sm">
                Monitor emotional wellbeing
              </p>
            </div>
          </div>
        </div>
      </WavyBackground>

      <div className="space-y-6 px-6 pt-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">4.2</p>
            <p className="text-[#6C7280] text-xs">Avg Mood</p>
          </Card>
          <Card className="p-4 text-center">
            <div className="mb-1 flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4 text-[#10B981]" />
              <p className="font-bold text-2xl text-[#10B981]">15%</p>
            </div>
            <p className="text-[#6C7280] text-xs">Improved</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">28</p>
            <p className="text-[#6C7280] text-xs">Entries</p>
          </Card>
        </div>

        {/* Mood Trend */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">Mood Trend</h2>
            <button className="font-medium text-[#003543] text-sm">
              7 Days
            </button>
          </div>
          <ResponsiveContainer height={200} width="100%">
            <LineChart data={moodData}>
              <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} stroke="#6C7280" />
              <YAxis domain={[0, 5]} fontSize={12} stroke="#6C7280" />
              <Tooltip />
              <Line
                activeDot={{ r: 6 }}
                dataKey="mood"
                dot={{ fill: "#8B5CF6", r: 4 }}
                stroke="#8B5CF6"
                strokeWidth={3}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Mood Distribution */}
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-[#1A1D1F] text-lg">
            Mood Distribution
          </h2>
          <div className="flex items-center gap-6">
            <div className="h-32 w-32">
              <ResponsiveContainer height="100%" width="100%">
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={moodDistribution}
                    dataKey="value"
                    innerRadius={30}
                    outerRadius={60}
                  >
                    {moodDistribution.map((entry, index) => (
                      <Cell fill={entry.color} key={`cell-${index}`} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {moodDistribution.map((item) => (
                <div
                  className="flex items-center justify-between text-sm"
                  key={item.name}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[#1A1D1F]">{item.name}</span>
                  </div>
                  <span className="font-medium text-[#6C7280]">
                    {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Quick Log */}
        <div>
          <h2 className="mb-4 font-semibold text-[#1A1D1F] text-lg">
            How are you feeling?
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {moodOptions.map((option) => (
              <button
                className="flex flex-col items-center gap-1 rounded-xl border-2 border-[#E5E7EB] p-3 transition-all hover:border-[#003543]/40 hover:bg-[#003543]/5"
                key={option.label}
                onClick={() => setShowAddModal(true)}
              >
                <span className="text-2xl">{option.emoji}</span>
                <span className="font-medium text-[#6C7280] text-xs">
                  {option.label}
                </span>
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
            {recentEntries.map((entry, index) => (
              <Card
                className="cursor-pointer p-4 transition-all hover:shadow-lg"
                key={index}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-2xl"
                    style={{ backgroundColor: `${entry.color}15` }}
                  >
                    {entry.emoji}
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="font-semibold text-[#1A1D1F]">
                        {entry.mood}
                      </h3>
                      <span className="text-[#6C7280] text-xs">
                        {entry.time}
                      </span>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1">
                      {entry.activities.map((activity) => (
                        <span
                          className="rounded-full bg-[#003543]/10 px-2 py-1 text-[#003543] text-xs"
                          key={activity}
                        >
                          {activity}
                        </span>
                      ))}
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

      {/* Add Mood Modal */}
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
                <h2 className="font-bold text-[#1A1D1F] text-xl">Log Mood</h2>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F4F6]"
                  onClick={() => setShowAddModal(false)}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-3 block font-medium text-[#1A1D1F] text-sm">
                    How are you feeling?
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {moodOptions.map((option, idx) => (
                      <button
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all ${
                          idx === 1
                            ? "border-[#003543] bg-[#003543]/5"
                            : "border-[#E5E7EB] hover:border-[#003543]/30"
                        }`}
                        key={option.label}
                      >
                        <span className="text-2xl">{option.emoji}</span>
                        <span className="font-medium text-[#6C7280] text-xs">
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Activities (Optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {activities.map((activity) => (
                      <button
                        className="rounded-full border border-[#E5E7EB] px-3 py-2 text-[#6C7280] text-sm transition-all hover:border-[#003543] hover:bg-[#003543]/5 hover:text-[#003543]"
                        key={activity}
                      >
                        {activity}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Notes (Optional)
                  </label>
                  <textarea
                    className="w-full resize-none rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    placeholder="What influenced your mood?"
                    rows={3}
                  />
                </div>

                <button className="w-full rounded-xl bg-[#003543] py-4 font-semibold text-white transition-colors hover:bg-[#003543]/90">
                  Save Mood
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
