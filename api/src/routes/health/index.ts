import Elysia from "elysia";
import { vitalsRoutes } from "./vitals.js";
import { symptomsRoutes } from "./symptoms.js";
import { medicationsRoutes } from "./medications.js";
import { moodsRoutes } from "./moods.js";
import { labsRoutes } from "./labs.js";
import { allergiesRoutes } from "./allergies.js";
import { escalationsRoutes } from "./escalations.js";
import { miscHealthRoutes } from "./misc.js";
import { deviceReadingsRoutes } from "./deviceReadings.js";
import { fallEventsRoutes } from "./fallEvents.js";
import { healthGoalsRoutes } from "./healthGoals.js";

export const healthRoutes = new Elysia({ prefix: "/api/health" })
  .use(vitalsRoutes)
  .use(symptomsRoutes)
  .use(medicationsRoutes)
  .use(moodsRoutes)
  .use(labsRoutes)
  .use(allergiesRoutes)
  .use(escalationsRoutes)
  .use(miscHealthRoutes)
  .use(deviceReadingsRoutes)
  .use(fallEventsRoutes)
  .use(healthGoalsRoutes);
