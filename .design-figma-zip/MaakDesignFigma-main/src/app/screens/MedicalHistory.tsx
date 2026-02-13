import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardList,
  FileText,
  Plus,
  User,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../components/ui/Card";
import { WavyBackground } from "../components/ui/WavyBackground";

export function MedicalHistory() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState("conditions");

  const conditions = [
    {
      name: "Type 2 Diabetes",
      diagnosed: "2018",
      status: "Managed",
      doctor: "Dr. Smith",
      color: "#3B82F6",
    },
    {
      name: "Hypertension",
      diagnosed: "2019",
      status: "Managed",
      doctor: "Dr. Smith",
      color: "#DC2626",
    },
    {
      name: "High Cholesterol",
      diagnosed: "2020",
      status: "Improving",
      doctor: "Dr. Johnson",
      color: "#F97316",
    },
  ];

  const surgeries = [
    {
      procedure: "Appendectomy",
      date: "March 2015",
      hospital: "City Hospital",
      doctor: "Dr. Williams",
    },
    {
      procedure: "Cataract Surgery",
      date: "June 2021",
      hospital: "Eye Center",
      doctor: "Dr. Lee",
    },
  ];

  const vaccinations = [
    {
      name: "COVID-19 Booster",
      date: "Jan 2024",
      nextDue: "Jan 2025",
      status: "current",
    },
    {
      name: "Flu Vaccine",
      date: "Oct 2023",
      nextDue: "Oct 2024",
      status: "due",
    },
    {
      name: "Tetanus",
      date: "May 2019",
      nextDue: "May 2029",
      status: "current",
    },
  ];

  const familyHistory = [
    { condition: "Heart Disease", relation: "Father", age: "65" },
    { condition: "Type 2 Diabetes", relation: "Mother", age: "60" },
    { condition: "Cancer (Breast)", relation: "Aunt", age: "55" },
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
                <FileText className="h-6 w-6 text-[#EB9C0C]" />
                <h1 className="font-bold text-2xl text-white">
                  Medical History
                </h1>
              </div>
              <p className="text-[#003543] text-sm">Complete health record</p>
            </div>
          </div>
        </div>
      </WavyBackground>

      <div className="space-y-6 px-6 pt-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: "conditions", label: "Conditions" },
            { id: "surgeries", label: "Surgeries" },
            { id: "vaccinations", label: "Vaccines" },
            { id: "family", label: "Family" },
          ].map((tab) => (
            <button
              className={`whitespace-nowrap rounded-xl px-4 py-2 font-medium text-sm transition-all ${
                activeTab === tab.id
                  ? "bg-[#003543] text-white"
                  : "bg-white text-[#6C7280] hover:bg-[#003543]/10"
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conditions Tab */}
        {activeTab === "conditions" && (
          <div className="space-y-3">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              Chronic Conditions
            </h2>
            {conditions.map((condition, index) => (
              <Card
                className="cursor-pointer p-4 transition-all hover:shadow-lg"
                key={index}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${condition.color}15` }}
                  >
                    <ClipboardList
                      className="h-6 w-6"
                      style={{ color: condition.color }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="font-semibold text-[#1A1D1F]">
                        {condition.name}
                      </h3>
                      <span className="rounded-full bg-[#10B981]/10 px-2 py-1 font-medium text-[#10B981] text-xs">
                        {condition.status}
                      </span>
                    </div>
                    <p className="mb-1 text-[#6C7280] text-sm">
                      Diagnosed: {condition.diagnosed}
                    </p>
                    <p className="text-[#6C7280] text-sm">
                      Provider: {condition.doctor}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#6C7280]" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Surgeries Tab */}
        {activeTab === "surgeries" && (
          <div className="space-y-3">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              Surgical History
            </h2>
            {surgeries.map((surgery, index) => (
              <Card
                className="cursor-pointer p-4 transition-all hover:shadow-lg"
                key={index}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#6366F1]/10">
                    <Building2 className="h-6 w-6 text-[#6366F1]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1 font-semibold text-[#1A1D1F]">
                      {surgery.procedure}
                    </h3>
                    <p className="mb-1 text-[#6C7280] text-sm">
                      <Calendar className="mr-1 inline h-3 w-3" />
                      {surgery.date}
                    </p>
                    <p className="text-[#6C7280] text-sm">
                      {surgery.hospital} • {surgery.doctor}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#6C7280]" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Vaccinations Tab */}
        {activeTab === "vaccinations" && (
          <div className="space-y-3">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              Vaccination Record
            </h2>
            {vaccinations.map((vax, index) => (
              <Card className="p-4" key={index}>
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                      vax.status === "due"
                        ? "bg-[#F97316]/10"
                        : "bg-[#10B981]/10"
                    }`}
                  >
                    <ClipboardList
                      className={`h-6 w-6 ${
                        vax.status === "due"
                          ? "text-[#F97316]"
                          : "text-[#10B981]"
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="font-semibold text-[#1A1D1F]">
                        {vax.name}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-1 font-medium text-xs ${
                          vax.status === "due"
                            ? "bg-[#F97316]/10 text-[#F97316]"
                            : "bg-[#10B981]/10 text-[#10B981]"
                        }`}
                      >
                        {vax.status === "due" ? "Due Soon" : "Current"}
                      </span>
                    </div>
                    <p className="mb-1 text-[#6C7280] text-sm">
                      Last: {vax.date}
                    </p>
                    <p className="text-[#6C7280] text-sm">
                      Next due: {vax.nextDue}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Family History Tab */}
        {activeTab === "family" && (
          <div className="space-y-3">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              Family Health History
            </h2>
            {familyHistory.map((item, index) => (
              <Card className="p-4" key={index}>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#8B5CF6]/10">
                    <User className="h-6 w-6 text-[#8B5CF6]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1 font-semibold text-[#1A1D1F]">
                      {item.condition}
                    </h3>
                    <p className="text-[#6C7280] text-sm">
                      {item.relation} • Diagnosed at age {item.age}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

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
                  Add Medical Record
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
                    Record Type
                  </label>
                  <select className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20">
                    <option>Condition</option>
                    <option>Surgery</option>
                    <option>Vaccination</option>
                    <option>Family History</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Name/Description
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    placeholder="e.g., Type 2 Diabetes"
                    type="text"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Date/Year
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    type="date"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Additional Notes
                  </label>
                  <textarea
                    className="w-full resize-none rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    placeholder="Provider, facility, or other relevant details"
                    rows={3}
                  />
                </div>

                <button className="w-full rounded-xl bg-[#003543] py-4 font-semibold text-white transition-colors hover:bg-[#003543]/90">
                  Add Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
