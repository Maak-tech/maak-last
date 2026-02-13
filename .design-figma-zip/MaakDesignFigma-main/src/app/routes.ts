import { createBrowserRouter } from "react-router";
import { Alerts } from "./screens/Alerts";
import { Allergies } from "./screens/Allergies";
import { BloodPressure } from "./screens/BloodPressure";
import { Care } from "./screens/Care";
import { DesignSystem } from "./screens/DesignSystem";
import { Family } from "./screens/Family";
import { HomeNew } from "./screens/HomeNew";
import { LabResults } from "./screens/LabResults";
import { MedicalHistory } from "./screens/MedicalHistory";
import { Medications } from "./screens/Medications";
import { Mood } from "./screens/Mood";
import { Onboarding } from "./screens/Onboarding";
import { ProfileNew } from "./screens/ProfileNew";
import { ScreenNavigator } from "./screens/ScreenNavigator";
import { Settings } from "./screens/Settings";
import { Track } from "./screens/Track";
import { TrackedSymptoms } from "./screens/TrackedSymptoms";
import { Trends } from "./screens/Trends";
import { VitalSigns } from "./screens/VitalSigns";
import { Zeina } from "./screens/Zeina";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: ScreenNavigator,
  },
  {
    path: "/onboarding",
    Component: Onboarding,
  },
  {
    path: "/home",
    Component: HomeNew,
  },
  {
    path: "/track",
    Component: Track,
  },
  {
    path: "/track/symptoms",
    Component: TrackedSymptoms,
  },
  {
    path: "/track/medications",
    Component: Medications,
  },
  {
    path: "/mood",
    Component: Mood,
  },
  {
    path: "/blood-pressure",
    Component: BloodPressure,
  },
  {
    path: "/vital-signs",
    Component: VitalSigns,
  },
  {
    path: "/allergies",
    Component: Allergies,
  },
  {
    path: "/medical-history",
    Component: MedicalHistory,
  },
  {
    path: "/lab-results",
    Component: LabResults,
  },
  {
    path: "/alerts",
    Component: Alerts,
  },
  {
    path: "/zeina",
    Component: Zeina,
  },
  {
    path: "/family",
    Component: Family,
  },
  {
    path: "/profile",
    Component: ProfileNew,
  },
  {
    path: "/trends",
    Component: Trends,
  },
  {
    path: "/care",
    Component: Care,
  },
  {
    path: "/settings",
    Component: Settings,
  },
  {
    path: "/design-system",
    Component: DesignSystem,
  },
]);
