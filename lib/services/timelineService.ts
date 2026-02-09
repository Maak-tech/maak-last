/* biome-ignore-all lint/complexity/noForEach: Timeline construction currently uses forEach-heavy transforms across heterogeneous event sources. */
/* biome-ignore-all lint/suspicious/useAwait: Week/month helpers intentionally keep async signatures for API consistency with other service methods. */
export type TimelineEvent = {
  id: string;
  type:
    | "symptom"
    | "medication"
    | "mood"
    | "allergy"
    | "vital"
    | "labResult"
    | "calendar"
    | "medicalHistory";
  title: string;
  description?: string;
  timestamp: Date;
  data: unknown; // Original data object
  color: string;
  icon?: string;
};

class TimelineService {
  /**
   * Aggregate all health events into a timeline
   */
  async getHealthTimeline(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];

    // Set default date range (last 90 days)
    const defaultStartDate = startDate || new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 90);
    const defaultEndDate = endDate || new Date();

    try {
      // Import services dynamically
      const [
        { symptomService },
        { medicationService },
        { moodService },
        { allergyService },
        { labResultService },
        { calendarService },
        { medicalHistoryService },
      ] = await Promise.all([
        import("./symptomService"),
        import("./medicationService"),
        import("./moodService"),
        import("./allergyService"),
        import("./labResultService"),
        import("./calendarService"),
        import("./medicalHistoryService"),
      ]);

      // Load all data types in parallel
      const [
        symptoms,
        medications,
        moods,
        allergies,
        labResults,
        calendarEvents,
        medicalHistory,
      ] = await Promise.all([
        symptomService.getUserSymptoms(userId, 1000),
        medicationService.getUserMedications(userId),
        moodService.getUserMoods(userId, 1000),
        allergyService.getUserAllergies(userId, 1000),
        labResultService.getUserLabResults(userId),
        calendarService.getUserEvents(userId, defaultStartDate, defaultEndDate),
        medicalHistoryService.getUserMedicalHistory(userId),
      ]);

      // Convert symptoms to timeline events
      symptoms.forEach((symptom) => {
        if (
          symptom.timestamp >= defaultStartDate &&
          symptom.timestamp <= defaultEndDate
        ) {
          events.push({
            id: `symptom-${symptom.id}`,
            type: "symptom",
            title: symptom.type,
            description: symptom.description || symptom.location,
            timestamp:
              symptom.timestamp instanceof Date
                ? symptom.timestamp
                : new Date(symptom.timestamp),
            data: symptom,
            color: this.getSeverityColor(symptom.severity),
            icon: "Activity",
          });
        }
      });

      // Convert medications to timeline events (start dates)
      medications.forEach((medication) => {
        if (
          medication.startDate >= defaultStartDate &&
          medication.startDate <= defaultEndDate
        ) {
          events.push({
            id: `medication-start-${medication.id}`,
            type: "medication",
            title: `${medication.name} - Started`,
            description: `${medication.dosage} • ${medication.frequency}`,
            timestamp:
              medication.startDate instanceof Date
                ? medication.startDate
                : new Date(medication.startDate),
            data: medication,
            color: "#3B82F6", // Blue
            icon: "Pill",
          });
        }

        // Add end date if exists
        if (
          medication.endDate &&
          medication.endDate >= defaultStartDate &&
          medication.endDate <= defaultEndDate
        ) {
          events.push({
            id: `medication-end-${medication.id}`,
            type: "medication",
            title: `${medication.name} - Ended`,
            description: medication.notes,
            timestamp:
              medication.endDate instanceof Date
                ? medication.endDate
                : new Date(medication.endDate),
            data: medication,
            color: "#64748B", // Gray
            icon: "Pill",
          });
        }
      });

      // Convert moods to timeline events
      moods.forEach((mood) => {
        if (
          mood.timestamp >= defaultStartDate &&
          mood.timestamp <= defaultEndDate
        ) {
          events.push({
            id: `mood-${mood.id}`,
            type: "mood",
            title: mood.mood,
            description: mood.notes || mood.activities?.join(", "),
            timestamp:
              mood.timestamp instanceof Date
                ? mood.timestamp
                : new Date(mood.timestamp),
            data: mood,
            color: this.getMoodColor(mood.mood),
            icon: "Smile",
          });
        }
      });

      // Convert allergies to timeline events
      allergies.forEach((allergy) => {
        if (
          allergy.timestamp >= defaultStartDate &&
          allergy.timestamp <= defaultEndDate
        ) {
          events.push({
            id: `allergy-${allergy.id}`,
            type: "allergy",
            title: allergy.name,
            description: allergy.reaction || allergy.severity,
            timestamp:
              allergy.timestamp instanceof Date
                ? allergy.timestamp
                : new Date(allergy.timestamp),
            data: allergy,
            color: "#EF4444", // Red
            icon: "AlertTriangle",
          });
        }
      });

      // Convert lab results to timeline events
      labResults.forEach((labResult) => {
        if (
          labResult.testDate >= defaultStartDate &&
          labResult.testDate <= defaultEndDate
        ) {
          events.push({
            id: `lab-${labResult.id}`,
            type: "labResult",
            title: labResult.testName,
            description: labResult.facility || labResult.testType,
            timestamp:
              labResult.testDate instanceof Date
                ? labResult.testDate
                : new Date(labResult.testDate),
            data: labResult,
            color: "#8B5CF6", // Purple
            icon: "TestTube",
          });
        }
      });

      // Convert calendar events
      calendarEvents.forEach((event) => {
        events.push({
          id: `calendar-${event.id}`,
          type: "calendar",
          title: event.title,
          description: event.description || event.location,
          timestamp:
            event.startDate instanceof Date
              ? event.startDate
              : new Date(event.startDate),
          data: event,
          color: event.color || "#10B981", // Green
          icon: "Calendar",
        });
      });

      // Convert medical history to timeline events
      medicalHistory.forEach((history) => {
        if (
          history.diagnosedDate &&
          history.diagnosedDate >= defaultStartDate &&
          history.diagnosedDate <= defaultEndDate
        ) {
          events.push({
            id: `history-${history.id}`,
            type: "medicalHistory",
            title: history.condition,
            description: history.notes || history.severity || "",
            timestamp:
              history.diagnosedDate instanceof Date
                ? history.diagnosedDate
                : new Date(history.diagnosedDate),
            data: history,
            color: "#F59E0B", // Orange
            icon: "FileText",
          });
        }
      });

      // Sort by timestamp (most recent first)
      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return events;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Filter timeline events by type
   */
  filterByType(
    events: TimelineEvent[],
    types: TimelineEvent["type"][]
  ): TimelineEvent[] {
    return events.filter((event) => types.includes(event.type));
  }

  /**
   * Filter timeline events by date range
   */
  filterByDateRange(
    events: TimelineEvent[],
    startDate: Date,
    endDate: Date
  ): TimelineEvent[] {
    return events.filter(
      (event) => event.timestamp >= startDate && event.timestamp <= endDate
    );
  }

  /**
   * Group events by date
   */
  groupByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
    const grouped = new Map<string, TimelineEvent[]>();

    events.forEach((event) => {
      const dateKey = event.timestamp.toISOString().split("T")[0];
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)?.push(event);
    });

    return grouped;
  }

  /**
   * Get severity color
   */
  private getSeverityColor(severity: number): string {
    if (severity >= 4) {
      return "#EF4444"; // Red
    }
    if (severity >= 3) {
      return "#F59E0B"; // Orange
    }
    if (severity >= 2) {
      return "#EAB308"; // Yellow
    }
    return "#10B981"; // Green
  }

  /**
   * Get mood color
   */
  private getMoodColor(mood: string): string {
    const moodColors: Record<string, string> = {
      happy: "#10B981",
      sad: "#3B82F6",
      anxious: "#F59E0B",
      angry: "#EF4444",
      calm: "#8B5CF6",
      excited: "#EC4899",
      tired: "#64748B",
      energetic: "#22C55E",
    };

    return moodColors[mood.toLowerCase()] || "#64748B";
  }

  /**
   * Get events for a specific day
   */
  async getEventsForDay(userId: string, date: Date): Promise<TimelineEvent[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const allEvents = await this.getHealthTimeline(
      userId,
      startOfDay,
      endOfDay
    );

    return allEvents;
  }

  /**
   * Get events for a week
   */
  async getEventsForWeek(
    userId: string,
    weekStart: Date
  ): Promise<TimelineEvent[]> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return this.getHealthTimeline(userId, weekStart, weekEnd);
  }

  /**
   * Get events for a month
   */
  async getEventsForMonth(
    userId: string,
    monthStart: Date
  ): Promise<TimelineEvent[]> {
    const monthEnd = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    return this.getHealthTimeline(userId, monthStart, monthEnd);
  }
}

export const timelineService = new TimelineService();
