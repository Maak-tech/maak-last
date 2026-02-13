import {
  AlertCircle,
  ArrowLeft,
  Bug,
  ChevronRight,
  Leaf,
  Pill,
  Plus,
  UtensilsCrossed,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../components/ui/Card";
import { WavyBackground } from "../components/ui/WavyBackground";

export function Allergies() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);

  const allergies = [
    {
      name: "Penicillin",
      type: "Medication",
      severity: "Severe",
      reaction: "Anaphylaxis, hives",
      icon: Pill,
      color: "#EF4444",
      diagnosed: "2015",
    },
    {
      name: "Peanuts",
      type: "Food",
      severity: "Moderate",
      reaction: "Swelling, difficulty breathing",
      icon: UtensilsCrossed,
      color: "#F97316",
      diagnosed: "2018",
    },
    {
      name: "Pollen",
      type: "Environmental",
      severity: "Mild",
      reaction: "Sneezing, itchy eyes",
      icon: Leaf,
      color: "#FBBF24",
      diagnosed: "2020",
    },
    {
      name: "Bee Stings",
      type: "Insect",
      severity: "Moderate",
      reaction: "Localized swelling",
      icon: Bug,
      color: "#F97316",
      diagnosed: "2019",
    },
  ];

  const severityColors: { [key: string]: string } = {
    Mild: "#FBBF24",
    Moderate: "#F97316",
    Severe: "#EF4444",
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
                <AlertCircle className="h-6 w-6 text-[#EB9C0C]" />
                <h1 className="font-bold text-2xl text-white">Allergies</h1>
              </div>
              <p className="text-[#003543] text-sm">
                Manage allergy information
              </p>
            </div>
          </div>
        </div>
      </WavyBackground>

      <div className="space-y-6 px-6 pt-6">
        {/* Alert Banner */}
        <Card className="border border-[#EF4444]/20 bg-[#EF4444]/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#EF4444]" />
            <div>
              <h3 className="mb-1 font-semibold text-[#EF4444]">
                Critical Allergies Alert
              </h3>
              <p className="text-[#EF4444]/80 text-sm">
                You have{" "}
                {allergies.filter((a) => a.severity === "Severe").length} severe
                allergy. Always carry emergency medication and inform healthcare
                providers.
              </p>
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">
              {allergies.length}
            </p>
            <p className="text-[#6C7280] text-xs">Total</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#EF4444]">
              {allergies.filter((a) => a.severity === "Severe").length}
            </p>
            <p className="text-[#6C7280] text-xs">Severe</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="mb-1 font-bold text-2xl text-[#003543]">
              {new Set(allergies.map((a) => a.type)).size}
            </p>
            <p className="text-[#6C7280] text-xs">Categories</p>
          </Card>
        </div>

        {/* Allergy List */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1D1F] text-lg">
              Known Allergies
            </h2>
            <button className="font-medium text-[#003543] text-sm">
              Export List
            </button>
          </div>

          <div className="space-y-3">
            {allergies.map((allergy, index) => {
              const Icon = allergy.icon;
              return (
                <Card
                  className="cursor-pointer p-4 transition-all hover:shadow-lg"
                  key={index}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${allergy.color}15` }}
                    >
                      <Icon
                        className="h-6 w-6"
                        style={{ color: allergy.color }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <h3 className="font-semibold text-[#1A1D1F]">
                          {allergy.name}
                        </h3>
                        <span
                          className="rounded-full px-2 py-1 font-medium text-xs"
                          style={{
                            backgroundColor: `${severityColors[allergy.severity]}15`,
                            color: severityColors[allergy.severity],
                          }}
                        >
                          {allergy.severity}
                        </span>
                      </div>
                      <p className="mb-1 text-[#6C7280] text-sm">
                        {allergy.type}
                      </p>
                      <p className="mb-2 text-[#003543] text-sm">
                        <strong>Reaction:</strong> {allergy.reaction}
                      </p>
                      <p className="text-[#6C7280] text-xs">
                        Diagnosed: {allergy.diagnosed}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[#6C7280]" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Emergency Info */}
        <Card className="bg-gradient-to-br from-[#F97316]/10 to-[#F97316]/5 p-5">
          <h3 className="mb-3 font-semibold text-[#1A1D1F]">
            Emergency Action Plan
          </h3>
          <div className="space-y-2 text-sm">
            <p className="text-[#6C7280]">
              <strong className="text-[#1A1D1F]">For Severe Reactions:</strong>
            </p>
            <ol className="ml-2 list-inside list-decimal space-y-1 text-[#6C7280]">
              <li>Administer EpiPen immediately</li>
              <li>Call emergency services (911)</li>
              <li>Lie down with feet elevated</li>
              <li>Monitor breathing and pulse</li>
            </ol>
            <p className="mt-3 text-[#6C7280] text-xs">
              <strong>EpiPen Location:</strong> Kitchen drawer, car glove box
            </p>
          </div>
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

      {/* Add Allergy Modal */}
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
                  Add Allergy
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
                    Allergen Name
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    placeholder="e.g., Penicillin"
                    type="text"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Type
                  </label>
                  <select className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20">
                    <option>Medication</option>
                    <option>Food</option>
                    <option>Environmental</option>
                    <option>Insect</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Severity
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Mild", "Moderate", "Severe"].map((level) => (
                      <button
                        className="rounded-xl border-2 border-[#E5E7EB] py-3 font-medium text-sm transition-all hover:border-[#003543]/30"
                        key={level}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Reaction Symptoms
                  </label>
                  <textarea
                    className="w-full resize-none rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    placeholder="Describe typical reaction symptoms"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium text-[#1A1D1F] text-sm">
                    Year Diagnosed
                  </label>
                  <input
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#003543]/20"
                    placeholder="2023"
                    type="number"
                  />
                </div>

                <button className="w-full rounded-xl bg-[#003543] py-4 font-semibold text-white transition-colors hover:bg-[#003543]/90">
                  Add Allergy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
