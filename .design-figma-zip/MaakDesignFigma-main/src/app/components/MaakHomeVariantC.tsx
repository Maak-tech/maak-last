import { Calendar, Heart, User } from "lucide-react";

// Variant C: Signature pattern - neutral background with watermark pattern (dots + calligraphy curve) and gold accents
export function MaakHomeVariantC() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FAFAFA]">
      {/* Watermark pattern - dots and calligraphy curve inspired by Maak logo */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.03]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            height="120"
            id="maakPattern"
            patternUnits="userSpaceOnUse"
            width="120"
            x="0"
            y="0"
          >
            {/* Dots pattern */}
            <circle cx="10" cy="10" fill="#003543" r="1.5" />
            <circle cx="60" cy="30" fill="#003543" r="1.5" />
            <circle cx="40" cy="70" fill="#003543" r="1.5" />
            <circle cx="90" cy="90" fill="#003543" r="1.5" />
            <circle cx="100" cy="50" fill="#003543" r="1.5" />

            {/* Subtle calligraphy curve */}
            <path
              d="M 20 40 Q 40 20, 60 40 T 100 40"
              fill="none"
              opacity="0.5"
              stroke="#003543"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect fill="url(#maakPattern)" height="100%" width="100%" />
      </svg>

      <div className="relative z-10">
        {/* Header with subtle gold accent */}
        <header className="relative px-6 py-6">
          {/* Minimal gold accent line */}
          <div className="absolute top-0 right-6 left-6 h-0.5 bg-gradient-to-r from-transparent via-[#EB9C0C]/30 to-transparent" />

          <div className="mt-4 mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#003543]">
                <div className="h-2 w-2 rounded-full bg-[#EB9C0C]" />
                {/* Small dots around logo */}
                <div className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-[#EB9C0C]/50" />
              </div>
              <span className="font-semibold text-2xl text-[#003543]">
                Maak
              </span>
            </div>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#003543]/5">
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
          {/* Quick Actions with gold accent */}
          <div className="grid grid-cols-2 gap-4">
            <button className="group relative overflow-hidden rounded-2xl bg-white p-6 text-left shadow-sm ring-1 ring-[#003543]/5 transition-all hover:shadow-md hover:ring-[#EB9C0C]/20">
              {/* Subtle gold accent on hover */}
              <div className="absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-[#EB9C0C] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#003543]/5">
                <Calendar className="h-6 w-6 text-[#003543]" />
              </div>
              <h3 className="mb-1 font-semibold text-[#003543]">
                Book Appointment
              </h3>
              <p className="text-[#003543]/60 text-sm">Schedule a visit</p>
            </button>

            <button className="group relative overflow-hidden rounded-2xl bg-white p-6 text-left shadow-sm ring-1 ring-[#003543]/5 transition-all hover:shadow-md hover:ring-[#EB9C0C]/20">
              <div className="absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-[#EB9C0C] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
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
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#003543]/5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-[#003543] text-lg">
                Upcoming Appointments
              </h2>
              <button className="text-[#EB9C0C] text-sm transition-colors hover:text-[#EB9C0C]/80">
                View all
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-4 rounded-xl bg-[#FAFAFA] p-4 ring-1 ring-[#003543]/5">
                <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#003543]">
                  <span className="font-semibold text-sm text-white">15</span>
                  {/* Small gold accent dot */}
                  <div className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-[#EB9C0C] ring-2 ring-white" />
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
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#003543]/5">
            <h2 className="mb-4 font-semibold text-[#003543] text-lg">
              Family Members
            </h2>
            <div className="flex gap-4">
              {["Sarah", "James", "Emma", "Add"].map((name, idx) => (
                <div className="flex flex-col items-center gap-2" key={name}>
                  <div
                    className={`relative flex h-16 w-16 items-center justify-center rounded-full ${
                      idx === 3
                        ? "border-2 border-[#003543]/20 border-dashed"
                        : "bg-gradient-to-br from-[#003543] to-[#003543]/80"
                    }`}
                  >
                    {idx === 3 ? (
                      <span className="text-2xl text-[#003543]/40">+</span>
                    ) : (
                      <>
                        <span className="font-semibold text-white">
                          {name[0]}
                        </span>
                        {idx === 0 && (
                          <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#EB9C0C] ring-2 ring-white" />
                        )}
                      </>
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
