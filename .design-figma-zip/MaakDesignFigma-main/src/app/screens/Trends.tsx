import { AlertCircle, ArrowLeft, TrendingDown } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { BottomNav } from "../components/ui/BottomNav";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { WavyBackground } from "../components/ui/WavyBackground";

export function Trends() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<"7" | "30" | "90">("30");
  const [selectedMetric, setSelectedMetric] = useState<
    "heart" | "sleep" | "activity" | "stress"
  >("heart");

  // Sample data with baseline and anomalies
  const heartRateData = [
    { day: "Feb 1", value: 72, baseline: 72, anomaly: false },
    { day: "Feb 3", value: 71, baseline: 72, anomaly: false },
    { day: "Feb 5", value: 73, baseline: 72, anomaly: false },
    { day: "Feb 7", value: 75, baseline: 72, anomaly: false },
    { day: "Feb 9", value: 78, baseline: 72, anomaly: true },
    { day: "Feb 11", value: 82, baseline: 72, anomaly: true },
    { day: "Feb 13", value: 76, baseline: 72, anomaly: false },
    { day: "Feb 15", value: 73, baseline: 72, anomaly: false },
  ];

  const metrics = [
    { id: "heart", label: "Heart Rate", unit: "bpm", color: "#EF4444" },
    { id: "sleep", label: "Sleep", unit: "hrs", color: "#3B82F6" },
    { id: "activity", label: "Activity", unit: "steps", color: "#10B981" },
    { id: "stress", label: "Stress", unit: "score", color: "#F59E0B" },
  ];

  const currentMetric = metrics.find((m) => m.id === selectedMetric)!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FAFB] via-[#F9FDFE] to-[#E6F7F9] pb-24">
      {/* Header with Wavy Background */}
      <WavyBackground variant="teal">
        <div className="px-6 pt-12 pb-4">
          <div className="mb-6 flex items-center gap-4">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
              onClick={() => navigate("/profile")}
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-2xl text-white">
                Health Trends
              </h1>
              <p className="text-sm text-white/70">Omar Hassan</p>
            </div>
          </div>

          {/* Metric tabs */}
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
            {metrics.map((metric) => (
              <button
                className={`whitespace-nowrap rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
                  selectedMetric === metric.id
                    ? "bg-[#EB9C0C] text-white"
                    : "bg-white/10 text-white/80 backdrop-blur-sm hover:bg-white/20"
                }`}
                key={metric.id}
                onClick={() =>
                  setSelectedMetric(metric.id as typeof selectedMetric)
                }
              >
                {metric.label}
              </button>
            ))}
          </div>
        </div>
      </WavyBackground>

      <div className="space-y-6 px-6 py-6">
        {/* Time range selector */}
        <div className="flex gap-2">
          {["7", "30", "90"].map((range) => (
            <button
              className={`rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
                timeRange === range
                  ? "bg-[#EB9C0C] text-white"
                  : "border border-[#E5E7EB] bg-white text-[#4E5661] hover:border-[#003543]/20"
              }`}
              key={range}
              onClick={() => setTimeRange(range as typeof timeRange)}
            >
              {range} days
            </button>
          ))}
        </div>

        {/* Chart */}
        <Card className="p-5">
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-[#1A1D1F]">
                {currentMetric.label} Trend
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: currentMetric.color }}
                  />
                  <span className="text-[#6C7280] text-xs">Current</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-0.5 w-3 bg-[#9CA3AF]" />
                  <span className="text-[#6C7280] text-xs">Baseline</span>
                </div>
              </div>
            </div>
            <p className="font-semibold text-2xl text-[#1A1D1F]">
              76 {currentMetric.unit}
            </p>
            <p className="flex items-center gap-1 text-[#10B981] text-sm">
              <TrendingDown className="h-4 w-4" />
              Improving from peak
            </p>
          </div>

          <div className="h-64">
            <ResponsiveContainer height="100%" width="100%">
              <ComposedChart
                data={heartRateData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorValue" x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={currentMetric.color}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor={currentMetric.color}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                <XAxis
                  axisLine={{ stroke: "#E5E7EB" }}
                  dataKey="day"
                  tick={{ fill: "#9CA3AF", fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={{ stroke: "#E5E7EB" }}
                  domain={[65, 85]}
                  tick={{ fill: "#9CA3AF", fontSize: 12 }}
                  tickLine={false}
                />
                <ReferenceLine
                  label={{ value: "Baseline", fill: "#9CA3AF", fontSize: 11 }}
                  stroke="#9CA3AF"
                  strokeDasharray="5 5"
                  y={72}
                />
                <Area
                  dataKey="value"
                  fill="url(#colorValue)"
                  fillOpacity={1}
                  stroke="none"
                  type="monotone"
                />
                <Line
                  dataKey="value"
                  dot={(props) => {
                    const { cx, cy, payload, index } = props;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        fill={payload.anomaly ? "#EF4444" : currentMetric.color}
                        key={`dot-${index}`}
                        r={payload.anomaly ? 6 : 4}
                        stroke="white"
                        strokeWidth={2}
                      />
                    );
                  }}
                  stroke={currentMetric.color}
                  strokeWidth={3}
                  type="monotone"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Context panel */}
        <Card className="border-[#F1D8A3] bg-[#FFF9EF] p-5">
          <div className="mb-4 flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#F59E0B]" />
            <div>
              <h3 className="mb-2 font-semibold text-[#1A1D1F]">
                What's happening?
              </h3>
              <p className="mb-3 text-[#4E5661] text-sm leading-relaxed">
                Heart rate increased by 14% above baseline on Feb 9-11. This
                coincided with reported sleep disruption and higher stress
                levels.
              </p>
              <p className="text-[#4E5661] text-sm leading-relaxed">
                <strong>Likely contributors:</strong> Reduced sleep quality
                (down 20%), medication timing change, increased activity.
              </p>
            </div>
          </div>
        </Card>

        {/* Risk level */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-[#1A1D1F]">Risk Level</h3>
            <span className="font-medium text-[#9CA3AF] text-xs">
              Confidence: 85%
            </span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[#6C7280] text-sm">Overall Risk</span>
                <span className="font-semibold text-[#F59E0B] text-sm">
                  Low-Medium
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#10B981] via-[#F59E0B] to-[#EF4444]"
                  style={{ width: "35%" }}
                />
              </div>
            </div>
            <p className="text-[#6C7280] text-xs leading-relaxed">
              Elevated heart rate is trending down and returning to baseline.
              Continue monitoring sleep quality and stress levels.
            </p>
          </div>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            fullWidth
            onClick={() => navigate("/zeina")}
            size="lg"
            variant="accent"
          >
            Ask Zeina what this means
          </Button>
          <Button fullWidth size="lg" variant="outline">
            Tune thresholds
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
