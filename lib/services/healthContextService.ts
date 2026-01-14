import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  type QuerySnapshot,
  where,
  type DocumentData,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export interface HealthContext {
  profile: {
    name: string;
    age: number;
    gender: string;
    bloodType: string;
    height: string;
    weight: string;
    emergencyContact: string;
    phone?: string;
    email?: string;
  };
  medicalHistory: {
    conditions: Array<{
      condition: string;
      diagnosedDate?: string;
      status?: string;
      notes?: string;
    }>;
    allergies: string[];
    surgeries: string[];
    familyHistory: Array<{
      condition: string;
      relationship?: string;
      notes?: string;
    }>;
  };
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    startDate: string;
    endDate?: string;
    notes?: string;
    isActive: boolean;
    reminders?: string[];
  }>;
  symptoms: Array<{
    name: string;
    severity: string;
    date: string;
    bodyPart?: string;
    duration?: string;
    notes?: string;
  }>;
  familyMembers: Array<{
    id: string;
    name: string;
    relationship: string;
    age?: number;
    conditions?: string[];
    email?: string;
    phone?: string;
    healthStatus?: string;
    recentSymptoms?: string[];
  }>;
  recentAlerts: Array<{
    type: string;
    timestamp: Date;
    details: string;
    severity?: string;
  }>;
  vitalSigns: {
    heartRate?: number;
    restingHeartRate?: number;
    walkingHeartRateAverage?: number;
    heartRateVariability?: number;
    bloodPressure?: string;
    respiratoryRate?: number;
    temperature?: number;
    oxygenLevel?: number;
    glucoseLevel?: number;
    weight?: number;
    height?: number;
    bodyFatPercentage?: number;
    steps?: number;
    sleepHours?: number;
    activeEnergy?: number;
    distanceWalkingRunning?: number;
    waterIntake?: number;
    lastUpdated?: Date;
  };
}

class HealthContextService {
  async getUserHealthContext(userId?: string): Promise<HealthContext> {
    const uid = userId || auth.currentUser?.uid;
    if (!uid) {
      throw new Error("No user ID provided");
    }

    try {
      // Fetch user profile first (needed for familyId)
      const userDoc = await getDoc(doc(db, "users", uid));
      const userData = userDoc.data() || {};

      // Prepare date for symptoms query
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // Parallelize independent queries for better performance
      const results = await Promise.allSettled([
        // Medications query
        getDocs(
          query(
            collection(db, "medications"),
            where("userId", "==", uid)
          )
        ),
        // Symptoms query
        getDocs(
          query(
            collection(db, "symptoms"),
            where("userId", "==", uid),
            where("timestamp", ">=", ninetyDaysAgo),
            orderBy("timestamp", "desc"),
            limit(50)
          )
        ),
        // Medical history query
        getDocs(
          query(
            collection(db, "medicalHistory"),
            where("userId", "==", uid),
            orderBy("diagnosedDate", "desc")
          )
        ),
        // Alerts query
        getDocs(
          query(
            collection(db, "alerts"),
            where("userId", "==", uid),
            orderBy("timestamp", "desc"),
            limit(20)
          )
        ),
        // Family members query (only if familyId exists)
        userData.familyId
          ? getDocs(
              query(
                collection(db, "users"),
                where("familyId", "==", userData.familyId)
              )
            )
          : getDocs(query(collection(db, "users"), limit(0))),
        // Vitals query - get vitals from vitals collection (get more samples for daily aggregation)
        // Get more samples to properly calculate daily totals for steps, energy, etc.
        getDocs(
          query(
            collection(db, "vitals"),
            where("userId", "==", uid),
            orderBy("timestamp", "desc"),
            limit(500)
          )
        ),
      ]);

      const [
        medicationsSnapshot,
        symptomsSnapshot,
        historySnapshot,
        alertsSnapshot,
        familySnapshot,
        vitalsSnapshot,
      ] = results;

      // Process medications
      let medications: HealthContext["medications"] = [];
      if (medicationsSnapshot.status === "fulfilled") {
        const medicationsWithSort = medicationsSnapshot.value.docs.map((doc) => {
          const data = doc.data();
          return {
            name: data.name || "Unknown medication",
            dosage: data.dosage || "",
            frequency: data.frequency || "",
            startDate: data.startDate?.toDate?.()?.toLocaleDateString() || "",
            endDate: data.endDate?.toDate?.()?.toLocaleDateString() || "",
            notes: data.notes || "",
            isActive: data.isActive !== false,
            reminders: data.reminders || [],
            _startDate: data.startDate?.toDate?.() || new Date(0),
          };
        });
        medicationsWithSort.sort(
          (a, b) => b._startDate.getTime() - a._startDate.getTime()
        );
        medications = medicationsWithSort.map(({ _startDate, ...med }) => med);
      }

      // Process symptoms
      let symptoms: HealthContext["symptoms"] = [];
      if (symptomsSnapshot.status === "fulfilled") {
        symptoms = symptomsSnapshot.value.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || data.symptom || "Unknown symptom",
            severity: data.severity || "moderate",
            date:
              data.timestamp?.toDate?.()?.toLocaleDateString() ||
              data.date ||
              "",
            bodyPart: data.bodyPart || data.location || "",
            duration: data.duration || "",
            notes: data.notes || data.description || "",
          };
        });
      }

      // Process medical history
      const medicalHistoryData: HealthContext["medicalHistory"]["conditions"] =
        [];
      const familyMedicalHistory: HealthContext["medicalHistory"]["familyHistory"] =
        [];
      if (historySnapshot.status === "fulfilled") {
        historySnapshot.value.docs.forEach((doc) => {
          const data = doc.data();
          const entry = {
            condition: data.condition || data.name || "",
            diagnosedDate:
              data.diagnosedDate?.toDate?.()?.toLocaleDateString() || "",
            status: data.status || "ongoing",
            notes: data.notes || "",
            relationship: data.relationship || "",
          };

          if (data.isFamily) {
            familyMedicalHistory.push(entry);
          } else {
            medicalHistoryData.push(entry);
          }
        });
      }

      // Process alerts
      let recentAlerts: HealthContext["recentAlerts"] = [];
      if (alertsSnapshot.status === "fulfilled") {
        recentAlerts = alertsSnapshot.value.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type || "general",
            timestamp: data.timestamp?.toDate() || new Date(),
            details: data.message || data.details || "",
            severity: data.severity || "info",
          };
        });
      }

      // Process family members (optimize N+1 query problem)
      const familyMembers: HealthContext["familyMembers"] = [];
      if (
        familySnapshot.status === "fulfilled" &&
        familySnapshot.value.docs.length > 0
      ) {
        const familyDocs = familySnapshot.value.docs.filter(
          (doc) => doc.id !== uid
        );

        // Batch fetch symptoms for all family members at once
        const familyMemberIds = familyDocs.map((doc) => doc.id);
        const familySymptomsPromises = familyMemberIds.map((memberId) =>
          getDocs(
            query(
              collection(db, "symptoms"),
              where("userId", "==", memberId),
              orderBy("timestamp", "desc"),
              limit(5)
            )
          ).catch(() => getDocs(query(collection(db, "symptoms"), limit(0))))
        );

        const familySymptomsResults = await Promise.allSettled(
          familySymptomsPromises
        );

        familyDocs.forEach((familyDoc, index) => {
          const memberData = familyDoc.data();
          const symptomsResult = familySymptomsResults[index];
          const memberSymptoms =
            symptomsResult.status === "fulfilled"
              ? symptomsResult.value.docs.map(
                  (doc) => doc.data().name || doc.data().symptom
                )
              : [];

          familyMembers.push({
            id: familyDoc.id,
            name:
              memberData.name || memberData.displayName || "Family Member",
            relationship:
              memberData.relationship ||
              memberData.relation ||
              memberData.role ||
              "Family Member",
            age: memberData.age,
            conditions: memberData.conditions || [],
            email: memberData.email,
            phone: memberData.phone || memberData.emergencyPhone,
            healthStatus:
              memberSymptoms.length > 0 ? "Has recent symptoms" : "Good",
            recentSymptoms: memberSymptoms,
          });
        });
      }

      // Process vitals from vitals collection
      let latestVitals: HealthContext["vitalSigns"] = {
        heartRate: userData.lastHeartRate,
        bloodPressure: userData.lastBloodPressure,
        temperature: userData.lastTemperature,
        oxygenLevel: userData.lastOxygenLevel,
        glucoseLevel: userData.lastGlucoseLevel,
        weight: userData.lastWeight,
        lastUpdated: userData.vitalsLastUpdated?.toDate(),
      };

      if (vitalsSnapshot.status === "fulfilled" && vitalsSnapshot.value.docs.length > 0) {
        // Get today's date range for aggregating daily totals
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Metrics that should use latest value (not summed)
        const latestValueMetrics = [
          "heartRate",
          "restingHeartRate",
          "bloodPressure",
          "respiratoryRate",
          "bodyTemperature",
          "oxygenSaturation",
          "bloodGlucose",
          "weight",
          "height",
        ];

        // Metrics that should be summed for daily totals
        const sumMetrics = [
          "steps",
          "activeEnergy",
          "basalEnergy",
          "distanceWalkingRunning",
          "sleepHours",
          "waterIntake",
        ];

        // Group vitals by type
        const vitalsByType: Record<string, Array<{ value: number; timestamp: Date; metadata?: any }>> = {};
        
        vitalsSnapshot.value.docs.forEach((doc) => {
          const data = doc.data();
          const vitalType = data.type;
          const timestamp = data.timestamp?.toDate?.() || new Date();
          
          if (!vitalsByType[vitalType]) {
            vitalsByType[vitalType] = [];
          }
          vitalsByType[vitalType].push({
            value: data.value,
            timestamp,
            metadata: data.metadata,
          });
        });

        // Helper to get latest value for a metric type
        const getLatestValue = (type: string) => {
          const samples = vitalsByType[type];
          if (!samples || samples.length === 0) return null;
          // Sort by timestamp descending and get the latest
          const sorted = [...samples].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          return sorted[0];
        };

        // Helper to get sum for today's samples
        const getTodaySum = (type: string) => {
          const samples = vitalsByType[type];
          if (!samples || samples.length === 0) return null;
          // Filter samples from today and sum them
          const todaySamples = samples.filter(
            (s) => s.timestamp >= today && s.timestamp < tomorrow
          );
          if (todaySamples.length === 0) return null;
          const sum = todaySamples.reduce((acc, s) => acc + s.value, 0);
          // Return the latest timestamp from today's samples
          const latestTimestamp = todaySamples.reduce((latest, s) =>
            s.timestamp > latest ? s.timestamp : latest,
            todaySamples[0].timestamp
          );
          return { sum, timestamp: latestTimestamp };
        };

        // Helper to update lastUpdated timestamp
        const updateTimestamp = (timestamp: Date) => {
          if (!latestVitals.lastUpdated || timestamp > latestVitals.lastUpdated) {
            latestVitals.lastUpdated = timestamp;
          }
        };

        // Process latest value metrics
        const heartRate = getLatestValue("heartRate");
        if (heartRate) {
          latestVitals.heartRate = heartRate.value;
          updateTimestamp(heartRate.timestamp);
        }

        const restingHeartRate = getLatestValue("restingHeartRate");
        if (restingHeartRate) {
          latestVitals.restingHeartRate = restingHeartRate.value;
          updateTimestamp(restingHeartRate.timestamp);
        }

        const walkingHeartRateAverage = getLatestValue("walkingHeartRateAverage");
        if (walkingHeartRateAverage) {
          latestVitals.walkingHeartRateAverage = walkingHeartRateAverage.value;
          updateTimestamp(walkingHeartRateAverage.timestamp);
        }

        const heartRateVariability = getLatestValue("heartRateVariability");
        if (heartRateVariability) {
          latestVitals.heartRateVariability = heartRateVariability.value;
          updateTimestamp(heartRateVariability.timestamp);
        }

        const bloodPressure = getLatestValue("bloodPressure");
        if (bloodPressure) {
          if (bloodPressure.metadata?.systolic && bloodPressure.metadata?.diastolic) {
            latestVitals.bloodPressure = `${bloodPressure.metadata.systolic}/${bloodPressure.metadata.diastolic}`;
          } else {
            latestVitals.bloodPressure = `${bloodPressure.value}`;
          }
          updateTimestamp(bloodPressure.timestamp);
        }

        const respiratoryRate = getLatestValue("respiratoryRate");
        if (respiratoryRate) {
          latestVitals.respiratoryRate = respiratoryRate.value;
          updateTimestamp(respiratoryRate.timestamp);
        }

        const bodyTemperature = getLatestValue("bodyTemperature");
        if (bodyTemperature) {
          latestVitals.temperature = bodyTemperature.value;
          updateTimestamp(bodyTemperature.timestamp);
        }

        const oxygenSaturation = getLatestValue("oxygenSaturation");
        if (oxygenSaturation) {
          latestVitals.oxygenLevel = oxygenSaturation.value;
          updateTimestamp(oxygenSaturation.timestamp);
        }

        const bloodGlucose = getLatestValue("bloodGlucose");
        if (bloodGlucose) {
          latestVitals.glucoseLevel = bloodGlucose.value;
          updateTimestamp(bloodGlucose.timestamp);
        }

        const weight = getLatestValue("weight");
        if (weight) {
          latestVitals.weight = weight.value;
          updateTimestamp(weight.timestamp);
        }

        const height = getLatestValue("height");
        if (height) {
          latestVitals.height = height.value;
          updateTimestamp(height.timestamp);
        }

        const bodyFatPercentage = getLatestValue("bodyFatPercentage");
        if (bodyFatPercentage) {
          latestVitals.bodyFatPercentage = bodyFatPercentage.value;
          updateTimestamp(bodyFatPercentage.timestamp);
        }

        // Process sum metrics (daily totals)
        const stepsSum = getTodaySum("steps");
        if (stepsSum) {
          latestVitals.steps = stepsSum.sum;
          updateTimestamp(stepsSum.timestamp);
        }

        const sleepHoursSum = getTodaySum("sleepHours");
        if (sleepHoursSum) {
          latestVitals.sleepHours = sleepHoursSum.sum;
          updateTimestamp(sleepHoursSum.timestamp);
        }

        const activeEnergySum = getTodaySum("activeEnergy");
        if (activeEnergySum) {
          latestVitals.activeEnergy = activeEnergySum.sum;
          updateTimestamp(activeEnergySum.timestamp);
        }

        const distanceSum = getTodaySum("distanceWalkingRunning");
        if (distanceSum) {
          latestVitals.distanceWalkingRunning = distanceSum.sum;
          updateTimestamp(distanceSum.timestamp);
        }

        const waterIntakeSum = getTodaySum("waterIntake");
        if (waterIntakeSum) {
          latestVitals.waterIntake = waterIntakeSum.sum;
          updateTimestamp(waterIntakeSum.timestamp);
        }
      }

      // Construct comprehensive health context
      const healthContext: HealthContext = {
        profile: {
          name: userData.displayName || userData.name || "User",
          age: userData.age || 0,
          gender: userData.gender || "Not specified",
          bloodType: userData.bloodType || "Unknown",
          height: userData.height || "Not specified",
          weight: userData.weight || "Not specified",
          emergencyContact:
            userData.emergencyContact || userData.emergencyPhone || "Not set",
          phone: userData.phone,
          email: userData.email || auth.currentUser?.email || "",
        },
        medicalHistory: {
          conditions: medicalHistoryData,
          allergies: userData.allergies || [],
          surgeries: userData.surgeries || [],
          familyHistory: familyMedicalHistory,
        },
        medications,
        symptoms,
        familyMembers,
        recentAlerts,
        vitalSigns: latestVitals,
      };

      return healthContext;
    } catch (error) {
      throw error;
    }
  }

  generateSystemPrompt(context: HealthContext, language: string = "en"): string {
    const activeMedications = context.medications.filter((m) => m.isActive);
    const inactiveMedications = context.medications.filter((m) => !m.isActive);

    const isArabic = language.startsWith("ar");

    const prompt = `${isArabic ?
      `أنت مساعد صحي ذكي مفيد لديك إمكانية الوصول إلى الملف الصحي الشامل للمستخدم.

يجب أن ترد باللغة العربية دائماً.` :
      `You are a helpful AI health assistant with access to the user's comprehensive health profile.

You must respond in English.`}

${isArabic ? `ملف المريض:` : `PATIENT PROFILE:`}
- Name: ${context.profile.name}
- Age: ${context.profile.age > 0 ? `${context.profile.age} years old` : "Not specified"}
- Gender: ${context.profile.gender}
- Blood Type: ${context.profile.bloodType}
- Height: ${context.profile.height}
- Weight: ${context.profile.weight}
- Emergency Contact: ${context.profile.emergencyContact}

${isArabic ? `التاريخ الطبي:
الحالات الحالية:` : `MEDICAL HISTORY:
Current Conditions:`} ${
      context.medicalHistory.conditions.length > 0
        ? context.medicalHistory.conditions
            .map(
              (c) =>
                `\n  • ${c.condition}${c.diagnosedDate ? ` (${isArabic ? 'تشخيص' : 'diagnosed'}: ${c.diagnosedDate})` : ""}${c.status ? ` - ${c.status}` : ""}${c.notes ? ` - ${c.notes}` : ""}`
            )
            .join("")
        : `\n  • ${isArabic ? 'لا توجد حالات مزمنة مسجلة' : 'No chronic conditions reported'}`
    }

${isArabic ? 'الحساسية:' : 'Allergies:'} ${
      context.medicalHistory.allergies.length > 0
        ? context.medicalHistory.allergies.map((a) => `\n  • ${a}`).join("")
        : `\n  • ${isArabic ? 'لا توجد حساسية معروفة' : 'No known allergies'}`
    }

${isArabic ? 'العمليات الجراحية السابقة:' : 'Previous Surgeries:'} ${
      context.medicalHistory.surgeries.length > 0
        ? context.medicalHistory.surgeries.map((s) => `\n  • ${s}`).join("")
        : `\n  • ${isArabic ? 'لا توجد عمليات جراحية سابقة' : 'No previous surgeries'}`
    }

${isArabic ? 'التاريخ الطبي العائلي:' : 'Family Medical History:'} ${
      context.medicalHistory.familyHistory.length > 0
        ? context.medicalHistory.familyHistory
            .map(
              (f) =>
                `\n  • ${f.condition}${f.relationship ? ` (${f.relationship})` : ""}`
            )
            .join("")
        : `\n  • ${isArabic ? 'لا يوجد تاريخ عائلي مسجل' : 'No family history recorded'}`
    }

${isArabic ? 'الأدوية الحالية:' : 'CURRENT MEDICATIONS:'}
${
  activeMedications.length > 0
    ? activeMedications
        .map(
          (med) =>
            `• ${med.name}: ${med.dosage}, ${med.frequency}
  ${isArabic ? 'بدء' : 'Started'}: ${med.startDate}${med.endDate ? `, ${isArabic ? 'ينتهي' : 'Ends'}: ${med.endDate}` : " (${isArabic ? 'مستمر' : 'ongoing'})"}
  ${med.reminders && med.reminders.length > 0 ? `${isArabic ? 'تذكيرات' : 'Reminders'}: ${med.reminders.join(", ")}` : ""}
  ${med.notes ? `${isArabic ? 'ملاحظات' : 'Notes'}: ${med.notes}` : ""}`
        )
        .join("\n")
    : `• ${isArabic ? 'لا توجد أدوية حالية' : 'No current medications'}`
}

${
  inactiveMedications.length > 0
    ? `\n${isArabic ? 'الأدوية السابقة:' : 'PAST MEDICATIONS:'}\n${inactiveMedications
        .slice(0, 5)
        .map((med) => `• ${med.name}: ${med.dosage} (${isArabic ? 'متوقف' : 'discontinued'})`)
        .join("\n")}`
    : ""
}

${isArabic ? 'الأعراض الأخيرة (آخر 90 يوماً):' : 'RECENT SYMPTOMS (Last 90 days):'}
${
  context.symptoms.length > 0
    ? context.symptoms
        .slice(0, 10)
        .map(
          (symptom) =>
            `• ${symptom.date}: ${symptom.name} (${isArabic ? 'الشدة' : 'Severity'}: ${symptom.severity})
  ${symptom.bodyPart ? `${isArabic ? 'الموقع' : 'Location'}: ${symptom.bodyPart}` : ""}
  ${symptom.duration ? `${isArabic ? 'المدة' : 'Duration'}: ${symptom.duration}` : ""}
  ${symptom.notes ? `${isArabic ? 'ملاحظات' : 'Notes'}: ${symptom.notes}` : ""}`
        )
        .join("\n")
    : `• ${isArabic ? 'لا توجد أعراض حديثة مسجلة' : 'No recent symptoms reported'}`
}

${isArabic ? 'أفراد العائلة:' : 'FAMILY MEMBERS:'}
${
  context.familyMembers.length > 0
    ? context.familyMembers
        .map(
          (member) =>
            `• ${member.name} (${member.relationship}${member.age ? `, ${member.age} ${isArabic ? 'سنوات' : 'years old'}` : ""})
  ${member.conditions && member.conditions.length > 0 ? `${isArabic ? 'الحالات' : 'Conditions'}: ${member.conditions.join(", ")}` : ""}
  ${member.healthStatus ? `${isArabic ? 'الحالة' : 'Status'}: ${member.healthStatus}` : ""}`
        )
        .join("\n")
    : `• ${isArabic ? 'لا يوجد أفراد عائلة متصلين بعد. يمكن إضافة أفراد العائلة من خلال تبويب العائلة.' : 'No family members connected yet. Family members can be added through the Family tab.'}`
}

${isArabic ? 'تنبيهات صحية حديثة:' : 'RECENT HEALTH ALERTS:'}
${context.recentAlerts.length > 0
  ? context.recentAlerts
      .slice(0, 5)
      .map(
        (alert) =>
          `• ${alert.timestamp.toLocaleDateString()}: ${alert.type} - ${alert.details}`
      )
      .join("\n")
  : ""
}

${
  context.vitalSigns.lastUpdated
    ? `
${isArabic ? 'العلامات الحيوية الأخيرة' : 'RECENT VITAL SIGNS'} (${context.vitalSigns.lastUpdated.toLocaleDateString()}):
• ${isArabic ? 'معدل ضربات القلب' : 'Heart Rate'}: ${context.vitalSigns.heartRate || (isArabic ? 'غير مسجل' : 'Not recorded')} bpm
• ${isArabic ? 'ضغط الدم' : 'Blood Pressure'}: ${context.vitalSigns.bloodPressure || (isArabic ? 'غير مسجل' : 'Not recorded')}
• ${isArabic ? 'درجة الحرارة' : 'Temperature'}: ${context.vitalSigns.temperature || (isArabic ? 'غير مسجل' : 'Not recorded')}°F
• ${isArabic ? 'مستوى الأكسجين' : 'Oxygen Level'}: ${context.vitalSigns.oxygenLevel || (isArabic ? 'غير مسجل' : 'Not recorded')}%
${context.vitalSigns.glucoseLevel ? `• ${isArabic ? 'الجلوكوز' : 'Glucose'}: ${context.vitalSigns.glucoseLevel} mg/dL` : ""}
${context.vitalSigns.weight ? `• ${isArabic ? 'الوزن' : 'Weight'}: ${context.vitalSigns.weight}` : ""}
`
    : ""
}

${isArabic ? 'تعليمات لردودك:' : 'INSTRUCTIONS FOR YOUR RESPONSES:'}
${isArabic ?
`1. قدم رؤى صحية مخصصة بناءً على الملف الطبي الكامل
2. ضع في اعتبارك جميع الأدوية عند مناقشة التفاعلات الدوائية أو العلاجات الجديدة
3. كن على دراية بجميع الحساسية والحالات عند تقديم النصائح
4. راجع الأعراض الأخيرة لتحديد الأنماط أو الاهتمامات
5. ضع في اعتبارك التاريخ الطبي العائلي لمخاطر الحالات الوراثية
6. ذكر دائماً المستخدمين باستشارة المتخصصين الصحيين للقرارات الطبية
7. كن متعاطفاً وداعماً مع كونك معلوماتياً
8. قدم نصائح عملية وقابلة للتنفيذ عند الاقتضاء
9. إذا لاحظت أنماطاً مقلقة في الأعراض أو العلامات الحيوية، اقترح بلطف استشارة طبية

تذكر: أنت مساعد ذكي تقدم معلومات ودعماً، وليس بديلاً عن النصيحة الطبية المهنية. شجع دائماً المستخدمين على طلب المساعدة الطبية المهنية للاهتمامات الخطيرة.` :
`1. Provide personalized health insights based on the complete medical profile
2. Consider all medications when discussing drug interactions or new treatments
3. Be aware of all allergies and conditions when giving advice
4. Reference recent symptoms to identify patterns or concerns
5. Consider family medical history for hereditary condition risks
6. Always remind users to consult healthcare professionals for medical decisions
7. Be empathetic and supportive while being informative
8. Provide practical, actionable advice when appropriate
9. If you notice concerning patterns in symptoms or vital signs, gently suggest medical consultation

Remember: You are an AI assistant providing information and support, not a replacement for professional medical advice. Always encourage users to seek professional medical help for serious concerns.`}`;

    return prompt;
  }

  async getContextualPrompt(userId?: string, language: string = "en"): Promise<string> {
    const context = await this.getUserHealthContext(userId);
    return this.generateSystemPrompt(context, language);
  }

  /**
   * Get a summary of the user's current health status
   * Used by the voice agent for quick health overview
   */
  async getHealthSummary(): Promise<any> {
    try {
      const context = await this.getUserHealthContext();
      
      return {
        profile: {
          name: context.profile.name,
          age: context.profile.age,
          bloodType: context.profile.bloodType,
        },
        activeMedicationsCount: context.medications.filter(m => m.isActive).length,
        recentSymptomsCount: context.symptoms.length,
        conditionsCount: context.medicalHistory.conditions.length,
        latestVitals: context.vitalSigns,
        alertsCount: context.recentAlerts.length,
        overallStatus: this.calculateOverallStatus(context),
      };
    } catch (error) {
      return { error: "Unable to fetch health summary" };
    }
  }

  /**
   * Calculate overall health status based on context
   */
  private calculateOverallStatus(context: HealthContext): string {
    const recentSymptoms = context.symptoms.filter(s => {
      const symptomDate = new Date(s.date);
      const daysDiff = (Date.now() - symptomDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    });

    if (recentSymptoms.some(s => s.severity === "severe" || s.severity === "high")) {
      return "Needs attention - severe symptoms reported recently";
    }
    if (recentSymptoms.length > 3) {
      return "Monitor closely - multiple symptoms reported";
    }
    if (context.recentAlerts.some(a => a.severity === "high" || a.severity === "urgent")) {
      return "Review alerts - important notifications pending";
    }
    return "Stable - no immediate concerns";
  }

  /**
   * Get user's medications list
   */
  async getMedications(activeOnly: boolean = true): Promise<any> {
    try {
      const context = await this.getUserHealthContext();
      const medications = activeOnly 
        ? context.medications.filter(m => m.isActive)
        : context.medications;

      return {
        medications: medications.map(med => ({
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          startDate: med.startDate,
          endDate: med.endDate,
          notes: med.notes,
          isActive: med.isActive,
          reminders: med.reminders,
        })),
        totalCount: medications.length,
        activeCount: context.medications.filter(m => m.isActive).length,
      };
    } catch (error) {
      return { error: "Unable to fetch medications", medications: [] };
    }
  }

  /**
   * Log a new symptom
   * Note: In production, this would save to Firestore
   */
  async logSymptom(symptomName: string, severity?: number, notes?: string): Promise<any> {
    try {
      // In a full implementation, this would save to Firestore
      // For now, we return a success response
      return {
        success: true,
        message: `Symptom "${symptomName}" logged successfully`,
        data: {
          name: symptomName,
          severity: severity || 5,
          notes: notes || "",
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return { success: false, error: "Failed to log symptom" };
    }
  }

  /**
   * Get recent vital signs
   */
  async getRecentVitals(vitalType: string = "all", days: number = 7): Promise<any> {
    try {
      const context = await this.getUserHealthContext();
      const vitals = context.vitalSigns;

      if (vitalType === "all") {
        return {
          vitals: {
            heartRate: vitals.heartRate ? `${vitals.heartRate} bpm` : "Not recorded",
            bloodPressure: vitals.bloodPressure || "Not recorded",
            temperature: vitals.temperature ? `${vitals.temperature}°F` : "Not recorded",
            oxygenSaturation: vitals.oxygenLevel ? `${vitals.oxygenLevel}%` : "Not recorded",
            weight: vitals.weight || "Not recorded",
            glucoseLevel: vitals.glucoseLevel ? `${vitals.glucoseLevel} mg/dL` : "Not recorded",
          },
          lastUpdated: vitals.lastUpdated?.toISOString() || "Never",
        };
      }

      // Return specific vital type
      const vitalMap: Record<string, any> = {
        heart_rate: { value: vitals.heartRate, unit: "bpm" },
        blood_pressure: { value: vitals.bloodPressure, unit: "mmHg" },
        temperature: { value: vitals.temperature, unit: "°F" },
        oxygen_saturation: { value: vitals.oxygenLevel, unit: "%" },
        weight: { value: vitals.weight, unit: "lbs" },
        glucose: { value: vitals.glucoseLevel, unit: "mg/dL" },
      };

      const vital = vitalMap[vitalType];
      return {
        type: vitalType,
        value: vital?.value || "Not recorded",
        unit: vital?.unit || "",
        lastUpdated: vitals.lastUpdated?.toISOString() || "Never",
      };
    } catch (error) {
      return { error: "Unable to fetch vitals" };
    }
  }

  /**
   * Check for potential medication interactions
   */
  async checkMedicationInteractions(newMedication?: string): Promise<any> {
    try {
      const context = await this.getUserHealthContext();
      const activeMeds = context.medications.filter(m => m.isActive);

      // In a full implementation, this would use a drug interaction database
      // For now, we provide general guidance
      const result: any = {
        currentMedications: activeMeds.map(m => m.name),
        allergies: context.medicalHistory.allergies,
        warnings: [],
        recommendations: [],
      };

      // Add general warnings based on number of medications
      if (activeMeds.length >= 5) {
        result.warnings.push("You are taking 5 or more medications. Please ensure your healthcare provider is aware of all medications.");
      }

      // Check against allergies if new medication provided
      if (newMedication) {
        result.newMedication = newMedication;
        result.recommendations.push(
          `Before starting ${newMedication}, please consult with your healthcare provider or pharmacist about potential interactions with your current medications.`
        );
      }

      return result;
    } catch (error) {
      return { error: "Unable to check medication interactions" };
    }
  }

  /**
   * Get emergency contact information
   */
  async getEmergencyContacts(action: string): Promise<any> {
    try {
      const context = await this.getUserHealthContext();

      switch (action) {
        case "get_contacts":
          return {
            primaryContact: context.profile.emergencyContact,
            phone: context.profile.phone,
            email: context.profile.email,
            familyMembers: context.familyMembers.map(m => ({
              name: m.name,
              relationship: m.relationship,
              phone: m.phone,
              email: m.email,
            })),
          };

        case "alert_family":
          // In production, this would trigger actual notifications
          return {
            success: true,
            message: "Family members have been notified",
            contactedMembers: context.familyMembers.map(m => m.name),
          };

        case "emergency_services_info":
          return {
            emergency: "911",
            poisonControl: "1-800-222-1222",
            note: "For medical emergencies, please call 911 immediately.",
          };

        default:
          return { error: "Unknown action" };
      }
    } catch (error) {
      return { error: "Unable to process emergency contact request" };
    }
  }
}

export default new HealthContextService();
