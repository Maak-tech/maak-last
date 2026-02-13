import {
  ArrowLeft,
  ChevronRight,
  Download,
  Droplet,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../components/ui/Card";
import { WavyBackground } from "../components/ui/WavyBackground";

export function LabResults() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);

  const recentTests = [
    {
      name: "Complete Blood Count",
      date: "Feb 8, 2024",
      facility: "City Lab",
      status: "normal",
      results: [
        {
          test: "WBC",
          value: "7.2",
          unit: "K/μL",
          range: "4.5-11.0",
          status: "normal",
        },
        {
          test: "RBC",
          value: "4.8",
          unit: "M/μL",
          range: "4.5-5.9",
          status: "normal",
        },
        {
          test: "Hemoglobin",
          value: "14.2",
          unit: "g/dL",
          range: "13.5-17.5",
          status: "normal",
        },
        {
          test: "Platelets",
          value: "225",
          unit: "K/μL",
          range: "150-400",
          status: "normal",
        },
      ],
    },
    {
      name: "Lipid Panel",
      date: "Feb 5, 2024",
      facility: "City Lab",
      status: "abnormal",
      results: [
        {
          test: "Total Cholesterol",
          value: "215",
          unit: "mg/dL",
          range: "<200",
          status: "high",
        },
        {
          test: "LDL",
          value: "135",
          unit: "mg/dL",
          range: "<100",
          status: "high",
        },
        {
          test: "HDL",
          value: "55",
          unit: "mg/dL",
          range: ">40",
          status: "normal",
        },
        {
          test: "Triglycerides",
          value: "145",
          unit: "mg/dL",
          range: "<150",
          status: "normal",
        },
      ],
    },
    {
      name: "Metabolic Panel",
      date: "Feb 1, 2024",
      facility: "City Lab",
      status: "normal",
      results: [
        {
          test: "Glucose",
          value: "95",
          unit: "mg/dL",
          range: "70-100",
          status: "normal",
        },
        {
          test: "Creatinine",
          value: "1.0",
          unit: "mg/dL",
          range: "0.7-1.3",
          status: "normal",
        },
        {
          test: "Sodium",
          value: "140",
          unit: "mEq/L",
          range: "136-145",
          status: "normal",
        },
        {
          test: "Potassium",
          value: "4.2",
          unit: "mEq/L",
          range: "3.5-5.0",
          status: "normal",
        },
      ],
    },
  ];

  const statusColors: { [key: string]: string } = {
    normal: "#10B981",
    high: "#F97316",
    low: "#3B82F6",
  };

  const getStatusIcon = (status: string) => {
    if (status === "high") return <TrendingUp className="h-4 w-4" />;
    if (status === "low") return <TrendingDown className="h-4 w-4" />;
    return null;
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
                <Droplet className="h-6 w-6 text-[#EB9C0C]" />
                <h1 className="font-bold text-2xl text-white">Lab Results</h1>
              </div>
              <p className="text-[#003543] text-sm">
                Track and store test results
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
            <p className="text-[#6C7280] text-xs">Recent Tests</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#10B981]">2</p>
            <p className="text-[#6C7280] text-xs">Normal</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#F97316]">1</p>
            <p className="text-[#6C7280] text-xs">Needs Review</p>
          </Card>
        </div>

        {/* Test Results */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              Recent Tests
            </h2>
            <button className="font-medium text-[#003543] text-sm">
              View All
            </button>
          </div>

          <div className="space-y-4">
            {recentTests.map((test, index) => (
              <Card className="p-5" key={index}>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="mb-1 font-semibold text-[#1A1D1F]">
                      {test.name}
                    </h3>
                    <p className="text-[#6C7280] text-sm">
                      {test.date} • {test.facility}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 font-medium text-xs ${
                        test.status === "normal"
                          ? "bg-[#10B981]/10 text-[#10B981]"
                          : "bg-[#F97316]/10 text-[#F97316]"
                      }`}
                    >
                      {test.status === "normal" ? "Normal" : "Review"}
                    </span>
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#003543]/10 transition-colors hover:bg-[#003543]/20">
                      <Download className="h-4 w-4 text-[#003543]" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {test.results.map((result, idx) => (
                    <div
                      className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2"
                      key={idx}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#1A1D1F] text-sm">
                          {result.test}
                        </span>
                        {result.status !== "normal" && (
                          <span style={{ color: statusColors[result.status] }}>
                            {getStatusIcon(result.status)}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#003543] text-sm">
                          {result.value} {result.unit}
                        </p>
                        <p className="text-[#6C7280] text-xs">
                          Range: {result.range}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg py-2 font-medium text-[#003543] text-sm transition-colors hover:bg-[#003543]/5">
                  View Full Report
                  <ChevronRight className="h-4 w-4" />
                </button>
              </Card>
            ))}
          </div>
        </div>

        {/* Tips */}
        <Card className="bg-gradient-to-br from-[#3B82F6]/10 to-[#3B82F6]/5 p-5">
          <h3 className="mb-2 font-semibold text-[#1A1D1F]">
            💡 Lab Test Tips
          </h3>
          <ul className="space-y-1 text-[#6C7280] text-sm">
            <li>• Fast 8-12 hours before lipid and glucose tests</li>
            <li>• Stay hydrated before blood draws</li>
            <li>• Bring previous results for comparison</li>
            <li>• Discuss abnormal results with your doctor</li>
          </ul>
        </Card>

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

      {/* Add Modal */}
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
                  Add Lab Result
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
                    Test Name
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    placeholder="e.g., Complete Blood Count"
                    type="text"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Test Date
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    type="date"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Lab/Facility
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    placeholder="e.g., City Lab"
                    type="text"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Upload PDF (Optional)
                  </label>
                  <div className="rounded-xl border-2 border-[#E5E7EB] border-dashed p-6 text-center">
                    <Droplet className="mx-auto mb-2 h-8 w-8 text-[#6C7280]" />
                    <p className="text-[#6C7280] text-sm">
                      Click to upload or drag file here
                    </p>
                    <p className="mt-1 text-[#6C7280] text-xs">PDF, max 10MB</p>
                  </div>
                </div>

                <button className="w-full rounded-xl bg-[#003543] py-4 font-semibold text-white transition-colors hover:bg-[#003543]/90">
                  Add Lab Result
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
