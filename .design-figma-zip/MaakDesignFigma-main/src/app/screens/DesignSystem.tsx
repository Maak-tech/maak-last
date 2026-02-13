import { Heart } from "lucide-react";
import { AlertCard } from "../components/ui/AlertCard";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Sparkline } from "../components/ui/Sparkline";
import { StatusBadge } from "../components/ui/StatusBadge";

export function DesignSystem() {
  const sampleData = [65, 70, 68, 75, 72, 78, 74];

  return (
    <div className="min-h-screen bg-[#F9FDFE] p-6">
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Header */}
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full bg-[#003543]" />
              <div className="h-3 w-3 rounded-full bg-[#EB9C0C]" />
            </div>
            <h1 className="font-bold text-3xl text-[#003543]">
              Maak Design System
            </h1>
          </div>
          <p className="text-[#6C7280]">Proactive care for families</p>
        </div>

        {/* Brand Colors */}
        <section>
          <h2 className="mb-4 font-semibold text-2xl text-[#1A1D1F]">
            Brand Colors
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-2 h-24 rounded-xl bg-[#003543]" />
              <p className="font-medium text-[#1A1D1F]">Primary Teal</p>
              <p className="text-[#6C7280] text-sm">#003543</p>
            </div>
            <div>
              <div className="mb-2 h-24 rounded-xl bg-[#EB9C0C]" />
              <p className="font-medium text-[#1A1D1F]">Accent Gold</p>
              <p className="text-[#6C7280] text-sm">#EB9C0C</p>
            </div>
            <div>
              <div className="mb-2 h-24 rounded-xl border-2 border-[#E5E7EB] bg-[#F9FDFE]" />
              <p className="font-medium text-[#1A1D1F]">Background Cool</p>
              <p className="text-[#6C7280] text-sm">#F9FDFE</p>
            </div>
            <div>
              <div className="mb-2 h-24 rounded-xl border-2 border-[#E5E7EB] bg-[#FFF9EF]" />
              <p className="font-medium text-[#1A1D1F]">Background Warm</p>
              <p className="text-[#6C7280] text-sm">#FFF9EF</p>
            </div>
          </div>
        </section>

        {/* Semantic Colors */}
        <section>
          <h2 className="mb-4 font-semibold text-2xl text-[#1A1D1F]">
            Semantic Colors
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="mb-2 h-16 rounded-xl bg-[#10B981]" />
              <p className="font-medium text-[#1A1D1F]">Success/Stable</p>
              <p className="text-[#6C7280] text-sm">#10B981</p>
            </div>
            <div>
              <div className="mb-2 h-16 rounded-xl bg-[#F59E0B]" />
              <p className="font-medium text-[#1A1D1F]">Warning/Monitor</p>
              <p className="text-[#6C7280] text-sm">#F59E0B</p>
            </div>
            <div>
              <div className="mb-2 h-16 rounded-xl bg-[#EF4444]" />
              <p className="font-medium text-[#1A1D1F]">Error/Attention</p>
              <p className="text-[#6C7280] text-sm">#EF4444</p>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2 className="mb-4 font-semibold text-2xl text-[#1A1D1F]">
            Typography
          </h2>
          <div className="space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-6">
            <div>
              <h1>Heading 1 - 30px Semibold</h1>
              <p className="text-[#6C7280] text-sm">
                Used for main page titles
              </p>
            </div>
            <div>
              <h2>Heading 2 - 24px Semibold</h2>
              <p className="text-[#6C7280] text-sm">Used for section headers</p>
            </div>
            <div>
              <h3>Heading 3 - 20px Semibold</h3>
              <p className="text-[#6C7280] text-sm">Used for card titles</p>
            </div>
            <div>
              <p>Body - 16px Regular</p>
              <p className="text-[#6C7280] text-sm">
                Used for standard text content
              </p>
            </div>
            <div>
              <p className="text-sm">Small - 14px Regular</p>
              <p className="text-[#6C7280] text-sm">
                Used for secondary information
              </p>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section>
          <h2 className="mb-4 font-semibold text-2xl text-[#1A1D1F]">
            Buttons
          </h2>
          <div className="space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-6">
            <div className="space-y-3">
              <Button fullWidth size="lg" variant="primary">
                <Heart className="h-5 w-5" />
                Primary Button
              </Button>
              <Button fullWidth size="lg" variant="secondary">
                Secondary Button
              </Button>
              <Button fullWidth size="lg" variant="accent">
                Accent Button
              </Button>
              <Button fullWidth size="lg" variant="outline">
                Outline Button
              </Button>
              <Button fullWidth size="lg" variant="ghost">
                Ghost Button
              </Button>
            </div>

            <div className="border-[#E5E7EB] border-t pt-4">
              <p className="mb-3 font-medium text-[#6C7280] text-sm">Sizes</p>
              <div className="flex gap-2">
                <Button size="sm" variant="primary">
                  Small
                </Button>
                <Button size="md" variant="primary">
                  Medium
                </Button>
                <Button size="lg" variant="primary">
                  Large
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section>
          <h2 className="mb-4 font-semibold text-2xl text-[#1A1D1F]">Cards</h2>
          <div className="space-y-4">
            <Card className="p-4" variant="standard">
              <h3 className="mb-2 font-semibold text-[#1A1D1F]">
                Standard Card
              </h3>
              <p className="text-[#6C7280] text-sm">
                Used for general content containers
              </p>
            </Card>

            <Card className="p-4" variant="highlight">
              <h3 className="mb-2 font-semibold text-[#1A1D1F]">
                Highlight Card
              </h3>
              <p className="text-[#6C7280] text-sm">
                Used for featured content like Zeina
              </p>
            </Card>

            <Card className="p-4" variant="alert">
              <h3 className="mb-2 font-semibold text-[#1A1D1F]">Alert Card</h3>
              <p className="text-[#6C7280] text-sm">
                Used for important notifications
              </p>
            </Card>
          </div>
        </section>

        {/* Status Badges */}
        <section>
          <h2 className="mb-4 font-semibold text-2xl text-[#1A1D1F]">
            Status Badges
          </h2>
          <div className="flex flex-wrap gap-3 rounded-xl border border-[#E5E7EB] bg-white p-6">
            <StatusBadge status="stable" />
            <StatusBadge status="monitor" />
            <StatusBadge status="attention" />
          </div>
        </section>

        {/* Alert Cards */}
        <section>
          <h2 className="mb-4 font-semibold text-2xl text-[#1A1D1F]">
            Alert Cards
          </h2>
          <div className="space-y-4">
            <AlertCard
              message="Immediate attention required for unusual vital signs"
              severity="critical"
              timestamp="2 min ago"
              title="Critical Alert"
            />
            <AlertCard
              message="Medication reminder or significant trend change"
              severity="important"
              timestamp="30 min ago"
              title="Important Alert"
            />
            <AlertCard
              message="General updates and positive trends"
              severity="info"
              timestamp="2 hours ago"
              title="Informational Alert"
            />
          </div>
        </section>

        {/* Avatars */}
        <section>
          <h2 className="mb-4 font-semibold text-2xl text-[#1A1D1F]">
            Avatars
          </h2>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <div className="flex items-end gap-6">
              <Avatar name="Sarah Ahmed" relationship="Mom" size="sm" />
              <Avatar
                name="Omar Hassan"
                relationship="Dad"
                size="md"
                status="monitor"
              />
              <Avatar
                name="Fatima Ali"
                relationship="Grandma"
                size="lg"
                status="stable"
              />
              <Avatar
                name="Ahmed Khalil"
                relationship="Grandpa"
                size="xl"
                status="attention"
              />
            </div>
          </div>
        </section>

        {/* Charts */}
        <section>
          <h2 className="mb-4 font-semibold text-2xl text-[#1A1D1F]">Charts</h2>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <p className="mb-4 font-medium text-[#6C7280] text-sm">
              Sparkline Chart
            </p>
            <div className="flex gap-6">
              <div>
                <Sparkline
                  color="#10B981"
                  data={sampleData}
                  height={50}
                  width={120}
                />
                <p className="mt-2 text-[#6C7280] text-xs">
                  Heart Rate (Green)
                </p>
              </div>
              <div>
                <Sparkline
                  color="#3B82F6"
                  data={sampleData}
                  height={50}
                  width={120}
                />
                <p className="mt-2 text-[#6C7280] text-xs">Sleep (Blue)</p>
              </div>
              <div>
                <Sparkline
                  color="#EB9C0C"
                  data={sampleData}
                  height={50}
                  width={120}
                />
                <p className="mt-2 text-[#6C7280] text-xs">Activity (Gold)</p>
              </div>
            </div>
          </div>
        </section>

        {/* Spacing System */}
        <section>
          <h2 className="mb-4 font-semibold text-2xl text-[#1A1D1F]">
            Spacing (8pt Grid)
          </h2>
          <div className="space-y-3 rounded-xl border border-[#E5E7EB] bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded bg-[#003543]" />
              <div className="flex-1">
                <p className="font-medium text-[#1A1D1F]">8px (0.5rem)</p>
                <p className="text-[#6C7280] text-sm">Minimum spacing unit</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded bg-[#003543]" />
              <div className="flex-1">
                <p className="font-medium text-[#1A1D1F]">16px (1rem)</p>
                <p className="text-[#6C7280] text-sm">Standard spacing</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 rounded bg-[#003543]" />
              <div className="flex-1">
                <p className="font-medium text-[#1A1D1F]">24px (1.5rem)</p>
                <p className="text-[#6C7280] text-sm">Section spacing</p>
              </div>
            </div>
          </div>
        </section>

        {/* Border Radius */}
        <section>
          <h2 className="mb-4 font-semibold text-2xl text-[#1A1D1F]">
            Border Radius
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 text-center">
              <div className="mx-auto mb-2 h-16 w-16 rounded-lg bg-[#003543]" />
              <p className="font-medium text-sm">Large (16px)</p>
            </div>
            <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 text-center">
              <div className="mx-auto mb-2 h-16 w-16 rounded-xl bg-[#003543]" />
              <p className="font-medium text-sm">XL (20px)</p>
            </div>
            <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 text-center">
              <div className="mx-auto mb-2 h-16 w-16 rounded-full bg-[#003543]" />
              <p className="font-medium text-sm">Full (Circle)</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
