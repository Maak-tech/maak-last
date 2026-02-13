import { Calendar, Heart, User } from "lucide-react";

// Variant A: Warm halo - cool off-white background with subtle gold glow behind header
export function MaakHomeVariantA() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8F9FA]">
      {/* Subtle gold glow behind header area */}
      <div className="absolute top-0 right-0 left-0 h-64 bg-gradient-radial from-[#EB9C0C]/10 via-[#EB9C0C]/5 to-transparent blur-3xl" />

      <div className="relative z-10">
        {/* Header */}
        <header className="px-6 py-6">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#003543]">
                <div className="h-2 w-2 rounded-full bg-[#EB9C0C]" />
              </div>
              <span className="font-semibold text-2xl text-[#003543]">
                Maak
              </span>
            </div>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
              <User className="h-5 w-5 text-[#003543]" />
            </button>
          </div>

          <div>
            <h1 className="mb-2 font-semibold text-3xl text-[#003543]">
              Welcome back, Sarah
            </h1>
            <p className="text-[#003543]/70">
              Your family's health at a glance
            </p>
          </div>
        </header>

        {/* Main Content */}
        <main className="space-y-6 px-6 pb-8">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button className="rounded-2xl bg-white p-6 text-left shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#003543]/5">
                <Calendar className="h-6 w-6 text-[#003543]" />
              </div>
              <h3 className="mb-1 font-semibold text-[#003543]">
                Book Appointment
              </h3>
              <p className="text-[#003543]/60 text-sm">Schedule a visit</p>
            </button>

            <button className="rounded-2xl bg-white p-6 text-left shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#EB9C0C]/10">
                <Heart className="h-6 w-6 text-[#EB9C0C]" />
              </div>
              <h3 className="mb-1 font-semibold text-[#003543]">
                Health Records
              </h3>
              <p className="text-[#003543]/60 text-sm">View history</p>
            </button>
          </div>

          {/* Upcoming Appointments */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-[#003543] text-lg">
                Upcoming Appointments
              </h2>
              <button className="text-[#EB9C0C] text-sm">View all</button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-4 rounded-xl bg-[#F8F9FA] p-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#003543]">
                  <span className="font-semibold text-sm text-white">15</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-[#003543]">Dr. Johnson</h4>
                  <p className="text-[#003543]/60 text-sm">
                    General Checkup - 2:30 PM
                  </p>
                </div>
                <div className="h-2 w-2 rounded-full bg-[#EB9C0C]" />
              </div>
            </div>
          </div>

          {/* Family Members */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-[#003543] text-lg">
              Family Members
            </h2>
            <div className="flex gap-4">
              {["Sarah", "James", "Emma", "Add"].map((name, idx) => (
                <div className="flex flex-col items-center gap-2" key={name}>
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-full ${
                      idx === 3
                        ? "border-2 border-[#003543]/20 border-dashed"
                        : "bg-gradient-to-br from-[#003543] to-[#003543]/80"
                    }`}
                  >
                    {idx === 3 ? (
                      <span className="text-2xl text-[#003543]/40">+</span>
                    ) : (
                      <span className="font-semibold text-white">
                        {name[0]}
                      </span>
                    )}
                  </div>
                  <span className="text-[#003543]/70 text-xs">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
