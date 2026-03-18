/**
 * VHIDimensionGrid
 *
 * Shows a compact grid of all 13 health dimensions tracked in the Virtual
 * Health Identity: current value vs personal baseline, deviation colour-code,
 * and a 7-day trend indicator.
 *
 * Dimensions with no data yet are rendered as a faded placeholder tile.
 * Stale dimensions (no new data in > 24 h) display a ⚠ indicator.
 */

import {
  ArrowDown,
  ArrowUp,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import { ScrollView, View, type ViewStyle } from "react-native";
import { Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { VHIDimension, VirtualHealthIdentity } from "@/types/vhi";

// ─── Types ────────────────────────────────────────────────────────────────────

// Use NonNullable because `dimensions` is optional on VirtualHealthIdentity —
// VHIDimensionGrid is only ever rendered when dimensions are present.
type DimensionKey = keyof NonNullable<VirtualHealthIdentity["currentState"]["dimensions"]>;

type Props = {
  dimensions: NonNullable<VirtualHealthIdentity["currentState"]["dimensions"]>;
  isRTL?: boolean;
};

// ─── Display metadata per dimension ──────────────────────────────────────────

const DIMENSION_META: Record<DimensionKey, { labelEn: string; labelAr: string; unit: string }> = {
  heartRate:          { labelEn: "Heart Rate",     labelAr: "معدل القلب",      unit: "bpm" },
  hrv:                { labelEn: "HRV",             labelAr: "تغير القلب",      unit: "ms" },
  sleepHours:         { labelEn: "Sleep",           labelAr: "النوم",           unit: "h" },
  steps:              { labelEn: "Steps",           labelAr: "الخطوات",         unit: "k" },
  mood:               { labelEn: "Mood",            labelAr: "المزاج",          unit: "/5" },
  symptomBurden:      { labelEn: "Symptoms",        labelAr: "الأعراض",         unit: "" },
  medicationAdherence:{ labelEn: "Adherence",       labelAr: "الالتزام",        unit: "%" },
  bloodPressure:      { labelEn: "Blood Pressure",  labelAr: "ضغط الدم",        unit: "" },
  bloodGlucose:       { labelEn: "Blood Glucose",   labelAr: "السكر",           unit: "" },
  oxygenSaturation:   { labelEn: "SpO₂",            labelAr: "الأكسجين",        unit: "%" },
  weight:             { labelEn: "Weight",          labelAr: "الوزن",           unit: "" },
  respiratoryRate:    { labelEn: "Resp. Rate",      labelAr: "معدل التنفس",     unit: "/min" },
  bodyTemperature:    { labelEn: "Temperature",     labelAr: "الحرارة",         unit: "°" },
};

const DIMENSION_ORDER: DimensionKey[] = [
  "heartRate", "hrv", "sleepHours", "steps",
  "mood", "symptomBurden", "medicationAdherence", "bloodPressure",
  "bloodGlucose", "oxygenSaturation", "weight", "respiratoryRate",
  "bodyTemperature",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatValue(key: DimensionKey, dim: VHIDimension): string {
  if (dim.currentValue === null) return "—";
  const v = dim.currentValue;
  if (key === "steps")              return `${(v / 1000).toFixed(1)}k`;
  if (key === "medicationAdherence") return `${Math.round(v)}%`;
  if (key === "oxygenSaturation")   return `${Math.round(v)}%`;
  if (key === "sleepHours")         return v.toFixed(1);
  if (key === "bodyTemperature")    return v.toFixed(1);
  return Math.round(v).toString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DirectionIcon({ direction, color }: { direction: VHIDimension["direction"]; color: string }) {
  const size = 11;
  if (direction === "above") return <ArrowUp color={color} size={size} />;
  if (direction === "below") return <ArrowDown color={color} size={size} />;
  return <Minus color={color} size={size} />;
}

function TrendIcon({ trend, color }: { trend: VHIDimension["trend7d"]; color: string }) {
  const size = 11;
  if (trend === "improving")  return <TrendingUp color={color} size={size} />;
  if (trend === "worsening")  return <TrendingDown color={color} size={size} />;
  return null;
}

function DimensionTile({
  dimensionKey,
  dim,
  isRTL,
}: {
  dimensionKey: DimensionKey;
  dim: VHIDimension;
  isRTL: boolean;
}) {
  const { theme } = useTheme();
  const meta = DIMENSION_META[dimensionKey];
  const hasData = dim.currentValue !== null;

  // Colour by deviation
  const deviationColor =
    dim.deviation === "significant"
      ? theme.colors.accent.error ?? "#EF4444"
      : dim.deviation === "moderate"
        ? theme.colors.accent.warning ?? "#F59E0B"
        : dim.deviation === "mild"
          ? "#6366F1"                                // indigo — slight deviation
          : theme.colors.accent.success ?? "#22C55E"; // none

  const borderColor = hasData ? deviationColor + "55" : theme.colors.border.light + "88";
  const bgColor     = hasData ? deviationColor + "12" : theme.colors.background.secondary;
  const textColor   = hasData ? deviationColor        : theme.colors.text.secondary;

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: bgColor,
          borderColor,
          opacity: dim.isStale && hasData ? 0.7 : 1,
        },
      ]}
    >
      {/* Label */}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 9,
          color: theme.colors.text.secondary,
          textAlign: "center",
          marginBottom: 3,
        }}
      >
        {isRTL ? meta.labelAr : meta.labelEn}
        {dim.isStale && hasData ? " ⚠" : ""}
      </Text>

      {/* Value + direction */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "700", color: textColor }}>
          {formatValue(dimensionKey, dim)}
        </Text>
        {hasData && (
          <DirectionIcon color={textColor} direction={dim.direction} />
        )}
      </View>

      {/* Unit */}
      {meta.unit ? (
        <Text style={{ fontSize: 8, color: theme.colors.text.secondary, textAlign: "center" }}>
          {meta.unit}
        </Text>
      ) : null}

      {/* 7-day trend */}
      {hasData && dim.trend7d !== "stable" && dim.trend7d !== "insufficient" ? (
        <View style={{ alignItems: "center", marginTop: 2 }}>
          <TrendIcon
            color={
              dim.trend7d === "worsening"
                ? theme.colors.accent.error ?? "#EF4444"
                : theme.colors.accent.success ?? "#22C55E"
            }
            trend={dim.trend7d}
          />
        </View>
      ) : null}

      {/* Baseline delta */}
      {hasData && dim.baselineValue !== null && dim.baselineValue > 0 ? (
        <Text
          style={{
            fontSize: 8,
            color: theme.colors.text.secondary,
            textAlign: "center",
            marginTop: 2,
          }}
        >
          {`base: ${Math.round(dim.baselineValue)}`}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VHIDimensionGrid({ dimensions, isRTL = false }: Props) {
  const { theme } = useTheme();

  const dataCount = DIMENSION_ORDER.filter(
    (k) => dimensions[k]?.currentValue !== null
  ).length;

  return (
    <View>
      {/* Header */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: theme.colors.text.secondary,
            letterSpacing: 0.6,
          }}
        >
          {isRTL ? "الأبعاد الصحية" : "HEALTH DIMENSIONS"}
        </Text>
        <Text style={{ fontSize: 10, color: theme.colors.text.secondary }}>
          {isRTL
            ? `${dataCount} / ${DIMENSION_ORDER.length} مرصود`
            : `${dataCount} / ${DIMENSION_ORDER.length} tracked`}
        </Text>
      </View>

      {/* Grid — wraps into rows of 4 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {DIMENSION_ORDER.map((key) => (
          <DimensionTile
            key={key}
            dimensionKey={key}
            dim={dimensions[key]}
            isRTL={isRTL}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  tile: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    width: 78,
    minHeight: 72,
  } as ViewStyle,
};
