/* biome-ignore-all lint/style/noNestedTernary: preserving existing UI conditional copy paths in this batch. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: large legacy screen to be split in future refactor batches. */
/* biome-ignore-all lint/performance/useTopLevelRegex: regex extraction will be lifted in a later dedicated performance pass. */
/* biome-ignore-all lint/complexity/noForEach: collection refactor deferred to a focused cleanup pass. */
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Minus,
  Pill,
  Plus,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CoachMark from "@/app/components/CoachMark";
import FamilyDataFilter, {
  type FilterOption,
} from "@/app/components/FamilyDataFilter";
import MedicationInteractionWarning from "@/app/components/MedicationInteractionWarning";
import MedicationRefillCard from "@/app/components/MedicationRefillCard";
import TagInput from "@/app/components/TagInput";
// Design System Components
import { Button, Input } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { Caption, Heading, Text } from "@/components/design-system/Typography";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { allergyService } from "@/lib/services/allergyService";
import { medicationRefillService } from "@/lib/services/medicationRefillService";
import { medicationService } from "@/lib/services/medicationService";
import { userService } from "@/lib/services/userService";
import { logger } from "@/lib/utils/logger";
import { convertTo12Hour, convertTo24Hour } from "@/lib/utils/timeFormat";
import type {
  Allergy,
  Medication,
  MedicationReminder,
  User as UserType,
} from "@/types";

const FREQUENCY_OPTIONS = [
  { key: "once", labelEn: "Once daily", labelAr: "مرة واحدة يومياً" },
  { key: "twice", labelEn: "Twice daily", labelAr: "مرتان يومياً" },
  { key: "thrice", labelEn: "Three times daily", labelAr: "ثلاث مرات يومياً" },
  { key: "meals", labelEn: "With meals", labelAr: "مع الوجبات" },
  { key: "needed", labelEn: "As needed", labelAr: "عند الحاجة" },
];

// Allergy keys mapping to translation keys (for conflict checking)
const ALLERGY_KEYS = [
  "allergyPeanuts",
  "allergyTreeNuts",
  "allergyMilk",
  "allergyEggs",
  "allergyFish",
  "allergyShellfish",
  "allergySoy",
  "allergyWheat",
  "allergyPollen",
  "allergyDustMites",
  "allergyPetDander",
  "allergyMold",
  "allergyLatex",
  "allergyPenicillin",
  "allergyAspirin",
  "allergyBeeStings",
  "allergySesame",
  "allergySulfites",
];

// Common medications in the Middle East
const COMMON_MEDICATIONS_MIDDLE_EAST = [
  // Pain & Fever Relief
  "Paracetamol",
  "Ibuprofen",
  "Aspirin",
  "Panadol",
  "Brufen",
  "Voltaren",
  "Diclofenac",
  // Antibiotics
  "Amoxicillin",
  "Augmentin",
  "Azithromycin",
  "Ciprofloxacin",
  "Cefuroxime",
  "Clarithromycin",
  "Erythromycin",
  // Antihistamines & Allergies
  "Cetirizine",
  "Loratadine",
  "Fexofenadine",
  "Desloratadine",
  "Claritin",
  "Zyrtec",
  // Digestive System
  "Omeprazole",
  "Pantoprazole",
  "Ranitidine",
  "Gaviscon",
  "Maalox",
  "Metoclopramide",
  "Domperidone",
  // Diabetes
  "Metformin",
  "Glibenclamide",
  "Gliclazide",
  "Insulin",
  // Hypertension & Heart
  "Amlodipine",
  "Atenolol",
  "Losartan",
  "Enalapril",
  "Captopril",
  "Propranolol",
  // Vitamins & Supplements
  "Vitamin D",
  "Vitamin C",
  "Calcium",
  "Iron",
  "Folic Acid",
  "Multivitamin",
  // Respiratory
  "Salbutamol",
  "Ventolin",
  "Beclomethasone",
  "Montelukast",
  // Antidepressants & Mental Health
  "Sertraline",
  "Fluoxetine",
  "Citalopram",
  "Escitalopram",
  // Cholesterol
  "Atorvastatin",
  "Simvastatin",
  "Rosuvastatin",
  // Thyroid
  "Levothyroxine",
  "Thyroxine",
  // Traditional/Herbal (commonly used in Middle East)
  "Honey",
  "Black Seed Oil",
  "Ginger",
  "Turmeric",
  "Cumin",
];

// Common dosages for medications (typical adult dosages)
const MEDICATION_DOSAGES: Record<string, string> = {
  // Pain & Fever Relief
  Paracetamol: "500mg",
  Ibuprofen: "400mg",
  Aspirin: "100mg",
  Panadol: "500mg",
  Brufen: "400mg",
  Voltaren: "50mg",
  Diclofenac: "50mg",
  // Antibiotics
  Amoxicillin: "500mg",
  Augmentin: "625mg",
  Azithromycin: "500mg",
  Ciprofloxacin: "500mg",
  Cefuroxime: "500mg",
  Clarithromycin: "500mg",
  Erythromycin: "500mg",
  // Antihistamines & Allergies
  Cetirizine: "10mg",
  Loratadine: "10mg",
  Fexofenadine: "180mg",
  Desloratadine: "5mg",
  Claritin: "10mg",
  Zyrtec: "10mg",
  // Digestive System
  Omeprazole: "20mg",
  Pantoprazole: "40mg",
  Ranitidine: "150mg",
  Gaviscon: "10-20ml",
  Maalox: "10-20ml",
  Metoclopramide: "10mg",
  Domperidone: "10mg",
  // Diabetes
  Metformin: "500mg",
  Glibenclamide: "5mg",
  Gliclazide: "80mg",
  Insulin: "As prescribed",
  // Hypertension & Heart
  Amlodipine: "5mg",
  Atenolol: "50mg",
  Losartan: "50mg",
  Enalapril: "5mg",
  Captopril: "25mg",
  Propranolol: "40mg",
  // Vitamins & Supplements
  "Vitamin D": "1000 IU",
  "Vitamin C": "500mg",
  Calcium: "500mg",
  Iron: "200mg",
  "Folic Acid": "5mg",
  Multivitamin: "1 tablet",
  // Respiratory
  Salbutamol: "100mcg",
  Ventolin: "100mcg",
  Beclomethasone: "100mcg",
  Montelukast: "10mg",
  // Antidepressants & Mental Health
  Sertraline: "50mg",
  Fluoxetine: "20mg",
  Citalopram: "20mg",
  Escitalopram: "10mg",
  // Cholesterol
  Atorvastatin: "20mg",
  Simvastatin: "20mg",
  Rosuvastatin: "10mg",
  // Thyroid
  Levothyroxine: "50mcg",
  Thyroxine: "50mcg",
  // Traditional/Herbal
  Honey: "1-2 teaspoons",
  "Black Seed Oil": "1 teaspoon",
  Ginger: "500mg",
  Turmeric: "500mg",
  Cumin: "As needed",
};

const MEDICATION_ACCENTS = [
  "#3B82F6",
  "#10B981",
  "#8B5CF6",
  "#F97316",
  "#EF4444",
];

export default function MedicationsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string; tour?: string }>();
  const [showAddModal, setShowAddModal] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const addMedicationButtonRef = useRef<View>(null);
  const [newMedication, setNewMedication] = useState({
    name: "",
    dosage: "",
    frequency: "",
    reminders: [] as { id?: string; time: string; period: "AM" | "PM" }[],
    notes: "",
    quantity: undefined as number | undefined,
    quantityUnit: "pills" as string,
    lastRefillDate: undefined as Date | undefined,
    refillReminderDays: 7 as number,
    tags: [] as string[],
  });
  const [editingMedication, setEditingMedication] = useState<Medication | null>(
    null
  );
  const [familyMembers, setFamilyMembers] = useState<UserType[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>({
    id: "personal",
    type: "personal",
    label: "",
  });
  const [selectedTargetUser, setSelectedTargetUser] = useState<string>("");
  const [medicationSuggestions, setMedicationSuggestions] = useState<string[]>(
    []
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [refillSummary, setRefillSummary] = useState(
    medicationRefillService.getRefillPredictions([])
  );
  const [userAllergies, setUserAllergies] = useState<Allergy[]>([]);

  const isRTL = i18n.language === "ar";

  const applyMedicationSuggestions = useCallback((query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      setMedicationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = COMMON_MEDICATIONS_MIDDLE_EAST.filter((med) =>
      med.toLowerCase().includes(normalizedQuery)
    );
    setMedicationSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  }, []);

  useEffect(() => {
    if (params.tour === "1") {
      setShowHowTo(true);
    }
  }, [params.tour]);

  useEffect(
    () => () => {
      if (suggestionsDebounceRef.current) {
        clearTimeout(suggestionsDebounceRef.current);
      }
    },
    []
  );
  const isAdmin = user?.role === "admin";
  const hasFamily = Boolean(user?.familyId);
  const {
    scheduleRecurringMedicationReminder,
    cancelMedicationNotifications,
    clearDuplicateMedicationNotifications,
  } = useNotifications();

  // Clear duplicate notifications on mount to fix any existing duplicates
  useEffect(() => {
    clearDuplicateMedicationNotifications();
  }, [clearDuplicateMedicationNotifications]);

  // Load user allergies
  const loadUserAllergies = useCallback(async () => {
    if (!user) {
      return;
    }
    try {
      const allergies = await allergyService.getUserAllergies(user.id);
      setUserAllergies(allergies);
    } catch (_error) {
      // Silently handle error - allergies check is not critical
    }
  }, [user]);

  useEffect(() => {
    loadUserAllergies();
  }, [loadUserAllergies]);

  const loadMedications = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        return;
      }

      const startTime = Date.now();
      let dataLoaded = false;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        logger.debug(
          "Loading medications",
          {
            userId: user.id,
            filterType: selectedFilter.type,
            isAdmin,
            hasFamily: Boolean(user.familyId),
          },
          "MedicationsScreen"
        );

        // Always load family members first if user has family
        let members: UserType[] = [];
        if (user.familyId) {
          members = await userService.getFamilyMembers(user.familyId);
          setFamilyMembers(members);
        }

        let loadedMedications: Medication[] = [];

        // Load data based on selected filter
        // Use Promise.allSettled to handle partial failures gracefully
        if (selectedFilter.type === "family" && user.familyId && isAdmin) {
          // Load family medications (admin only)
          const [medicationsResult, refillResult] = await Promise.allSettled([
            medicationService.getFamilyTodaysMedications(
              user.id,
              user.familyId
            ),
            medicationService.getFamilyMedications(user.id, user.familyId),
          ]);

          if (medicationsResult.status === "fulfilled") {
            loadedMedications = medicationsResult.value;
            setMedications(loadedMedications);
            dataLoaded = true;
          } else {
            logger.error(
              "Failed to load family medications",
              medicationsResult.reason,
              "MedicationsScreen"
            );
            setMedications([]);
          }

          if (refillResult.status === "fulfilled") {
            const summary = medicationRefillService.getRefillPredictions(
              refillResult.value
            );
            setRefillSummary(summary);
          } else {
            logger.error(
              "Failed to load family medications for refill",
              refillResult.reason,
              "MedicationsScreen"
            );
            setRefillSummary(medicationRefillService.getRefillPredictions([]));
          }
        } else if (
          selectedFilter.type === "member" &&
          selectedFilter.memberId &&
          isAdmin
        ) {
          // Load specific member medications (admin only)
          const medicationsResult = await medicationService
            .getMemberMedications(selectedFilter.memberId)
            .catch((error) => {
              logger.error(
                "Failed to load member medications",
                error,
                "MedicationsScreen"
              );
              return [] as Medication[];
            });

          loadedMedications = medicationsResult;
          setMedications(loadedMedications);
          dataLoaded = true;

          // Use the same medications for refill calculation
          const summary =
            medicationRefillService.getRefillPredictions(loadedMedications);
          setRefillSummary(summary);
        } else {
          // Load personal medications (default)
          const medicationsResult = await medicationService
            .getUserMedications(user.id)
            .catch((error) => {
              logger.error(
                "Failed to load user medications",
                error,
                "MedicationsScreen"
              );
              return [] as Medication[];
            });

          loadedMedications = medicationsResult;
          setMedications(loadedMedications);
          dataLoaded = true;

          // Use the same medications for refill calculation
          const summary =
            medicationRefillService.getRefillPredictions(loadedMedications);
          setRefillSummary(summary);
        }

        const durationMs = Date.now() - startTime;
        logger.info(
          "Medications loaded",
          {
            userId: user.id,
            filterType: selectedFilter.type,
            medicationCount: loadedMedications.length,
            durationMs,
          },
          "MedicationsScreen"
        );
      } catch (error) {
        const durationMs = Date.now() - startTime;

        // Check if it's a Firestore index error
        const isIndexError =
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "failed-precondition";

        if (isIndexError) {
          logger.warn(
            "Firestore index not ready for medications query",
            {
              userId: user.id,
              filterType: selectedFilter.type,
              durationMs,
            },
            "MedicationsScreen"
          );

          // Only show alert if no data was loaded (fallback should have handled it)
          if (!dataLoaded) {
            Alert.alert(
              isRTL ? "خطأ" : "Error",
              isRTL
                ? "فهرس قاعدة البيانات غير جاهز. يرجى المحاولة مرة أخرى بعد قليل."
                : "Database index not ready. Please try again in a moment."
            );
          }
        } else {
          logger.error(
            "Failed to load medications",
            error,
            "MedicationsScreen"
          );

          // Only show alert if no data was loaded
          if (!dataLoaded) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : isRTL
                  ? "حدث خطأ في تحميل البيانات"
                  : "Error loading data";

            Alert.alert(isRTL ? "خطأ" : "Error", errorMessage);
          }
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, selectedFilter, isAdmin, isRTL]
  );

  // Refresh data when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadMedications();
    }, [loadMedications])
  );

  // Cleanup timeout on unmount
  useEffect(
    () => () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    },
    []
  );

  const handleFilterChange = (filter: FilterOption) => {
    setSelectedFilter(filter);
  };

  // Check if medication conflicts with allergies
  const checkMedicationAllergyConflict = (
    medicationName: string,
    allergies: Allergy[]
  ): Allergy[] => {
    if (!medicationName || allergies.length === 0) {
      return [];
    }

    const medicationLower = medicationName.toLowerCase().trim();
    const conflicts: Allergy[] = [];

    // Mapping of allergy translation keys to medication names/substrings
    const allergyToMedicationMap: Record<string, string[]> = {
      allergyPenicillin: [
        "penicillin",
        "amoxicillin",
        "augmentin",
        "ampicillin",
      ],
      allergyAspirin: ["aspirin", "acetylsalicylic"],
      allergySulfites: ["sulfite", "sulfa", "sulfonamide"],
    };

    allergies.forEach((allergy) => {
      let allergyName = allergy.name.toLowerCase();

      // Handle translation keys (e.g., "allergyPenicillin" -> "penicillin")
      if (allergy.name.startsWith("allergy")) {
        const key = allergy.name;
        if (allergyToMedicationMap[key]) {
          // Check if medication contains any of the mapped medication names
          const hasConflict = allergyToMedicationMap[key].some((med) =>
            medicationLower.includes(med)
          );
          if (hasConflict) {
            conflicts.push(allergy);
            return;
          }
        }
        // Extract base name from key (e.g., "allergyPenicillin" -> "penicillin")
        allergyName = allergy.name.replace(/^allergy/, "").toLowerCase();
      }

      // Check for direct match or if medication contains allergy name
      if (
        medicationLower === allergyName ||
        medicationLower.includes(allergyName) ||
        allergyName.includes(medicationLower)
      ) {
        conflicts.push(allergy);
      }
    });

    return conflicts;
  };

  const getMemberName = (userId: string): string => {
    if (userId === user?.id) {
      return isRTL ? "أنت" : "You";
    }
    const member = familyMembers.find((m) => m.id === userId);
    if (!member) {
      return isRTL ? "عضو غير معروف" : "Unknown Member";
    }
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    if (member.firstName) {
      return member.firstName;
    }
    return isRTL ? "عضو غير معروف" : "Unknown Member";
  };

  const handleAddMedication = async () => {
    if (!user) {
      return;
    }

    if (
      !(newMedication.name && newMedication.dosage && newMedication.frequency)
    ) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يرجى ملء جميع الحقول المطلوبة"
          : "Please fill in all required fields"
      );
      return;
    }

    // Validate that reminders are provided for regular medications
    if (
      newMedication.frequency !== "needed" &&
      newMedication.reminders.length === 0
    ) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يرجى إضافة وقت تذكير واحد على الأقل"
          : "Please add at least one reminder time"
      );
      return;
    }

    // Validate reminder times format (HH:MM)
    const invalidReminders = newMedication.reminders.filter(
      (r) => !r.time?.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    );

    if (invalidReminders.length > 0) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يرجى إدخال أوقات التذكير بالتنسيق الصحيح (مثال: 8:00)"
          : "Please enter reminder times in correct format (e.g., 8:00)"
      );
      return;
    }

    // Check for allergy conflicts
    const targetUserId = selectedTargetUser || user.id;
    let allergiesToCheck = userAllergies;

    // If adding for another user, we should check their allergies, but for now check current user's
    // In a production system, you'd load the target user's allergies
    if (targetUserId !== user.id && isAdmin) {
      // For now, we'll still check current user's allergies as a safety measure
      // In production, you'd fetch targetUserId's allergies here
      allergiesToCheck = userAllergies;
    }

    const conflictingAllergies = checkMedicationAllergyConflict(
      newMedication.name,
      allergiesToCheck
    );

    if (conflictingAllergies.length > 0) {
      // Get translated allergy names
      const getTranslatedAllergyName = (allergyName: string): string => {
        const englishToKeyMap: Record<string, string> = {
          Peanuts: "allergyPeanuts",
          "Tree Nuts": "allergyTreeNuts",
          Milk: "allergyMilk",
          Eggs: "allergyEggs",
          Fish: "allergyFish",
          Shellfish: "allergyShellfish",
          Soy: "allergySoy",
          Wheat: "allergyWheat",
          Pollen: "allergyPollen",
          "Dust Mites": "allergyDustMites",
          "Pet Dander": "allergyPetDander",
          Mold: "allergyMold",
          Latex: "allergyLatex",
          Penicillin: "allergyPenicillin",
          Aspirin: "allergyAspirin",
          "Bee Stings": "allergyBeeStings",
          Sesame: "allergySesame",
          Sulfites: "allergySulfites",
        };

        // Check if it's a translation key (common allergy)
        if (
          allergyName.startsWith("allergy") &&
          ALLERGY_KEYS.includes(allergyName)
        ) {
          return t(allergyName);
        }

        // Check if it's an old English name that needs mapping
        if (englishToKeyMap[allergyName]) {
          return t(englishToKeyMap[allergyName]);
        }

        // Otherwise return as-is (custom allergy)
        return allergyName;
      };

      const allergyNames = conflictingAllergies
        .map((a) => getTranslatedAllergyName(a.name))
        .join(", ");

      const severityText = conflictingAllergies.some(
        (a) =>
          a.severity === "severe" || a.severity === "severe-life-threatening"
      )
        ? isRTL
          ? "خطيرة"
          : "severe"
        : "";

      Alert.alert(
        isRTL ? "⚠️ تحذير: تعارض مع الحساسية" : "⚠️ Warning: Allergy Conflict",
        isRTL
          ? `هذا الدواء قد يتعارض مع الحساسيات التالية: ${allergyNames}${severityText ? `\n\nتحذير: بعض هذه الحساسيات ${severityText}!` : ""}\n\nهل أنت متأكد من رغبتك في المتابعة؟`
          : `This medication may conflict with the following allergies: ${allergyNames}${severityText ? `\n\nWarning: Some of these allergies are ${severityText}!` : ""}\n\nAre you sure you want to proceed?`,
        [
          {
            text: isRTL ? "إلغاء" : "Cancel",
            style: "cancel",
            onPress: () => {
              // User cancelled, don't proceed
            },
          },
          {
            text: isRTL ? "المتابعة على أي حال" : "Proceed Anyway",
            style: "destructive",
            onPress: async () => {
              // User confirmed, proceed with saving
              await proceedWithMedicationSave();
            },
          },
        ]
      );
      return;
    }

    // Proceed with saving if no conflicts
    await proceedWithMedicationSave();
  };

  const proceedWithMedicationSave = async () => {
    if (!user) {
      return;
    }

    try {
      setLoading(true);

      if (editingMedication) {
        // Update existing medication
        const updateData: Partial<Medication> = {
          name: newMedication.name,
          dosage: newMedication.dosage,
          frequency: newMedication.frequency,
          reminders: newMedication.reminders.map((reminder, index) => {
            // Combine time and period, then convert to 24-hour format
            const timeWithPeriod = `${reminder.time} ${reminder.period || "AM"}`;
            return {
              id: reminder.id || `${Date.now()}_${index}`, // Preserve existing ID or generate new one
              time: convertTo24Hour(timeWithPeriod), // Convert to 24-hour for storage
              taken: false,
            };
          }),
          ...(newMedication.notes.trim() && {
            notes: newMedication.notes.trim(),
          }),
          ...(newMedication.quantity !== undefined && {
            quantity: newMedication.quantity,
          }),
          ...(newMedication.quantityUnit && {
            quantityUnit: newMedication.quantityUnit,
          }),
          ...(newMedication.lastRefillDate && {
            lastRefillDate: newMedication.lastRefillDate,
          }),
          refillReminderDays: newMedication.refillReminderDays,
          ...(newMedication.tags &&
            newMedication.tags.length > 0 && {
              tags: newMedication.tags,
            }),
        };

        await medicationService.updateMedication(
          editingMedication.id,
          updateData
        );

        // Reschedule notifications for updated reminders (only for current user's medications)
        if (
          editingMedication.userId === user.id &&
          newMedication.reminders.length > 0
        ) {
          // First, cancel all existing notifications for the old medication name
          // This prevents duplicate notifications when editing
          await cancelMedicationNotifications(editingMedication.name);

          // If the medication name changed, also cancel notifications for the new name
          if (editingMedication.name !== newMedication.name) {
            await cancelMedicationNotifications(newMedication.name);
          }

          const schedulingResults: { success: boolean; error?: string }[] = [];
          for (const reminder of newMedication.reminders) {
            if (reminder.time?.trim()) {
              const result = await scheduleRecurringMedicationReminder(
                newMedication.name,
                newMedication.dosage,
                reminder.time,
                {
                  medicationId: editingMedication?.id,
                  reminderId: reminder.id,
                }
              );
              schedulingResults.push(result || { success: false });
            }
          }

          // Check if any scheduling failed
          const failedSchedules = schedulingResults.filter((r) => !r.success);
          if (failedSchedules.length > 0) {
            const errorMessage = failedSchedules[0]?.error || "Unknown error";
            const isPermissionError = errorMessage
              .toLowerCase()
              .includes("permission");

            Alert.alert(
              isRTL ? "تحذير" : "Warning",
              isRTL
                ? `تم تحديث الدواء بنجاح، لكن فشل جدولة التذكير.${isPermissionError ? " يرجى تفعيل أذونات الإشعارات في إعدادات التطبيق." : ""}\n\n${errorMessage}`
                : `Medication updated successfully, but failed to schedule reminder.${isPermissionError ? " Please enable notification permissions in app settings." : ""}\n\n${errorMessage}`,
              [
                { text: isRTL ? "حسناً" : "OK", style: "cancel" },
                ...(isPermissionError
                  ? [
                      {
                        text: isRTL ? "فتح الإعدادات" : "Open Settings",
                        onPress: () => {
                          if (Platform.OS === "ios") {
                            Linking.openURL("app-settings:");
                          } else {
                            Linking.openSettings();
                          }
                        },
                      },
                    ]
                  : []),
              ]
            );
          }
        }
        setEditingMedication(null);
      } else {
        // Add new medication
        const targetUserIdForSave = selectedTargetUser || user.id;
        const medicationData: Omit<Medication, "id"> = {
          userId: targetUserIdForSave,
          name: newMedication.name,
          dosage: newMedication.dosage,
          frequency: newMedication.frequency,
          startDate: new Date(),
          reminders: newMedication.reminders.map((reminder, index) => {
            // Combine time and period, then convert to 24-hour format
            const timeWithPeriod = `${reminder.time} ${reminder.period || "AM"}`;
            return {
              id: `${Date.now()}_${index}`,
              time: convertTo24Hour(timeWithPeriod), // Convert to 24-hour for storage
              taken: false,
            };
          }),
          ...(newMedication.notes.trim() && {
            notes: newMedication.notes.trim(),
          }),
          ...(newMedication.quantity !== undefined && {
            quantity: newMedication.quantity,
          }),
          ...(newMedication.quantityUnit && {
            quantityUnit: newMedication.quantityUnit,
          }),
          ...(newMedication.lastRefillDate && {
            lastRefillDate: newMedication.lastRefillDate,
          }),
          refillReminderDays: newMedication.refillReminderDays,
          ...(newMedication.tags &&
            newMedication.tags.length > 0 && {
              tags: newMedication.tags,
            }),
          isActive: true,
        };

        let savedMedicationId: string | null = null;
        if (isAdmin && targetUserIdForSave !== user.id) {
          // Admin adding medication for another family member
          savedMedicationId = await medicationService.addMedicationForUser(
            medicationData,
            targetUserIdForSave
          );
        } else {
          // User adding medication for themselves
          savedMedicationId =
            await medicationService.addMedication(medicationData);
        }

        // Schedule notifications for reminders (only for current user's medications)
        if (
          targetUserIdForSave === user.id &&
          newMedication.reminders.length > 0
        ) {
          const schedulingResults: { success: boolean; error?: string }[] = [];
          for (const reminder of newMedication.reminders) {
            if (reminder.time?.trim()) {
              const result = await scheduleRecurringMedicationReminder(
                newMedication.name,
                newMedication.dosage,
                reminder.time,
                {
                  medicationId: savedMedicationId || undefined,
                  reminderId: reminder.id,
                }
              );
              schedulingResults.push(result || { success: false });
            }
          }

          // Check if any scheduling failed
          const failedSchedules = schedulingResults.filter((r) => !r.success);
          if (failedSchedules.length > 0) {
            const errorMessage = failedSchedules[0]?.error || "Unknown error";
            const isPermissionError = errorMessage
              .toLowerCase()
              .includes("permission");

            Alert.alert(
              isRTL ? "تحذير" : "Warning",
              isRTL
                ? `تمت إضافة الدواء بنجاح، لكن فشل جدولة التذكير.${isPermissionError ? " يرجى تفعيل أذونات الإشعارات في إعدادات التطبيق." : ""}\n\n${errorMessage}`
                : `Medication added successfully, but failed to schedule reminder.${isPermissionError ? " Please enable notification permissions in app settings." : ""}\n\n${errorMessage}`,
              [
                { text: isRTL ? "حسناً" : "OK", style: "cancel" },
                ...(isPermissionError
                  ? [
                      {
                        text: isRTL ? "فتح الإعدادات" : "Open Settings",
                        onPress: () => {
                          if (Platform.OS === "ios") {
                            Linking.openURL("app-settings:");
                          } else {
                            Linking.openSettings();
                          }
                        },
                      },
                    ]
                  : []),
              ]
            );
          }
        }
      }

      // Reset form
      setNewMedication({
        name: "",
        dosage: "",
        frequency: "",
        reminders: [{ time: "", period: "AM" }],
        notes: "",
        quantity: undefined,
        quantityUnit: "pills",
        lastRefillDate: undefined,
        refillReminderDays: 7,
        tags: [],
      });
      setSelectedTargetUser("");
      setMedicationSuggestions([]);
      setShowSuggestions(false);
      setShowAddModal(false);

      // Reload medications and allergies
      await loadMedications();
      await loadUserAllergies();

      Alert.alert(
        isRTL ? "تمت العملية" : "Success",
        isRTL
          ? editingMedication
            ? "تم تحديث الدواء بنجاح"
            : "تم إضافة الدواء بنجاح"
          : editingMedication
            ? "Medication updated successfully"
            : "Medication added successfully"
      );
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في حفظ الدواء" : "Error saving medication"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditMedication = (medication: Medication) => {
    // Check permissions
    const canEdit =
      medication.userId === user?.id ||
      (isAdmin &&
        (selectedFilter.type === "family" || selectedFilter.type === "member"));
    if (!canEdit) {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لتعديل هذا الدواء"
          : "You do not have permission to edit this medication"
      );
      return;
    }

    // Clear any existing timeout
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    setEditingMedication(medication);
    setNewMedication({
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      quantity: medication.quantity,
      quantityUnit: medication.quantityUnit || "pills",
      lastRefillDate: medication.lastRefillDate,
      refillReminderDays: medication.refillReminderDays || 7,
      reminders: medication.reminders.map((reminder) => {
        // Parse 24-hour time to get time and period
        const [hoursStr, minutesStr] = reminder.time.split(":");
        const hours = Number.parseInt(hoursStr, 10);
        let timeValue = "";
        let periodValue: "AM" | "PM" = "AM";

        if (hours >= 12) {
          periodValue = "PM";
          if (hours > 12) {
            timeValue = `${hours - 12}:${minutesStr}`;
          } else {
            timeValue = `12:${minutesStr}`;
          }
        } else {
          periodValue = "AM";
          if (hours === 0) {
            timeValue = `12:${minutesStr}`;
          } else {
            timeValue = reminder.time;
          }
        }

        return {
          id: reminder.id, // Preserve existing ID when editing
          time: timeValue,
          period: periodValue,
        };
      }),
      notes: medication.notes || "",
      tags: medication.tags || [],
    });
    setSelectedTargetUser(medication.userId);
    // Clear suggestions state when opening edit modal
    setMedicationSuggestions([]);
    setShowSuggestions(false);
    setShowAddModal(true);
  };

  const handleDeleteMedication = (medication: Medication) => {
    // Check permissions
    const canDelete =
      medication.userId === user?.id ||
      (isAdmin &&
        (selectedFilter.type === "family" || selectedFilter.type === "member"));
    if (!canDelete) {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لحذف هذا الدواء"
          : "You do not have permission to delete this medication"
      );
      return;
    }

    Alert.alert(
      isRTL ? "حذف الدواء" : "Delete Medication",
      isRTL
        ? `هل أنت متأكد من رغبتك في حذف: ${medication.name}؟`
        : `Are you sure you want to delete: ${medication.name}?`,
      [
        {
          text: isRTL ? "إلغاء" : "Cancel",
          style: "cancel",
        },
        {
          text: isRTL ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);

              // Cancel any scheduled notifications for this medication
              if (medication.userId === user?.id) {
                await cancelMedicationNotifications(medication.name);
              }

              await medicationService.deleteMedication(medication.id);
              await loadMedications();
              Alert.alert(
                isRTL ? "تم الحذف" : "Deleted",
                isRTL
                  ? "تم حذف الدواء بنجاح"
                  : "Medication deleted successfully"
              );
            } catch (_error) {
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL ? "حدث خطأ في حذف الدواء" : "Error deleting medication"
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const toggleMedicationTaken = async (
    medicationId: string,
    reminderId: string
  ) => {
    try {
      await medicationService.markMedicationTaken(medicationId, reminderId);

      // Reload medications from Firebase to ensure data is in sync
      await loadMedications();
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في تحديث الدواء" : "Error updating medication"
      );
    }
  };

  const getMedicationAccent = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % MEDICATION_ACCENTS.length;
    return MEDICATION_ACCENTS[index];
  };

  const getTimeUntil = (time: string | undefined) => {
    if (!(time && time.includes(":"))) {
      return "";
    }
    const [hoursStr, minutesStr] = time.split(":");
    const hours = Number.parseInt(hoursStr, 10);
    const minutes = Number.parseInt(minutesStr, 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return "";
    }
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    if (target < now) {
      target.setDate(target.getDate() + 1);
    }
    const diffMinutes = Math.max(
      0,
      Math.round((target.getTime() - now.getTime()) / 60_000)
    );
    if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    }
    const diffHours = Math.round(diffMinutes / 60);
    return `${diffHours} hour${diffHours === 1 ? "" : "s"}`;
  };

  const getTodayStats = () => {
    const currentTotalMeds = medications.length;
    const currentTakenMeds = medications.filter(
      (med) =>
        Array.isArray(med.reminders) &&
        med.reminders.some((reminder) => reminder.taken)
    ).length;
    return { totalMeds: currentTotalMeds, takenMeds: currentTakenMeds };
  };

  const getNextDoseText = (medication: Medication) => {
    const reminders = Array.isArray(medication.reminders)
      ? medication.reminders
      : [];
    if (reminders.length === 0) {
      return "No reminders set";
    }

    const now = new Date();
    const todayReminders = reminders.filter(
      (reminder: MedicationReminder) => !reminder.taken
    );

    if (todayReminders.length === 0) {
      return "All doses taken today";
    }

    const nextReminder = todayReminders[0];
    const [hours, minutes] = nextReminder.time.split(":");
    const nextDoseTime = new Date();
    nextDoseTime.setHours(
      Number.parseInt(hours, 10),
      Number.parseInt(minutes, 10),
      0,
      0
    );

    if (nextDoseTime < now) {
      nextDoseTime.setDate(nextDoseTime.getDate() + 1);
    }

    return `Next: ${convertTo12Hour(nextReminder.time)}`;
  };

  const { totalMeds, takenMeds } = getTodayStats();
  const activeMedications = medications.filter(
    (medication) => medication.isActive
  );
  const activeMedsCount = activeMedications.length || medications.length;
  const displayMedications =
    activeMedications.length > 0 ? activeMedications : medications;
  const adherence =
    totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : 0;
  const dueToday = Math.max(totalMeds - takenMeds, 0);

  const parseTimeToMinutes = (time: string | undefined) => {
    if (!(time && time.includes(":"))) {
      return Number.MAX_SAFE_INTEGER;
    }
    const [hours, minutes] = time.split(":");
    const hoursValue = Number.parseInt(hours, 10);
    const minutesValue = Number.parseInt(minutes, 10);
    if (Number.isNaN(hoursValue) || Number.isNaN(minutesValue)) {
      return Number.MAX_SAFE_INTEGER;
    }
    return hoursValue * 60 + minutesValue;
  };

  const upcomingDoses = activeMedications
    .flatMap((medication) => {
      const reminders = Array.isArray(medication.reminders)
        ? medication.reminders
        : [];
      return reminders
        .filter((reminder) => !reminder.taken)
        .map((reminder) => ({ medication, reminder }));
    })
    .sort(
      (a, b) =>
        parseTimeToMinutes(a.reminder.time) -
        parseTimeToMinutes(b.reminder.time)
    )
    .slice(0, 4);

  const recentHistory = activeMedications
    .flatMap((medication) => {
      const reminders = Array.isArray(medication.reminders)
        ? medication.reminders
        : [];
      return reminders
        .filter((reminder) => reminder.taken)
        .map((reminder) => ({ medication, reminder }));
    })
    .sort(
      (a, b) =>
        parseTimeToMinutes(b.reminder.time) -
        parseTimeToMinutes(a.reminder.time)
    )
    .slice(0, 4);

  if (!user) {
    return (
      <SafeAreaView
        edges={["top"]}
        pointerEvents="box-none"
        style={styles.container}
      >
        <View style={styles.centerContainer}>
          <Text color="#EF4444" style={styles.errorText}>
            Please log in to track medications
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.figmaMedicationContent}
        refreshControl={
          <RefreshControl
            onRefresh={() => loadMedications(true)}
            refreshing={refreshing}
            tintColor="#0F766E"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.figmaMedicationHeaderWrap}>
          <WavyBackground curve="home" height={160} variant="teal">
            <View style={styles.figmaMedicationHeaderContent}>
              <View style={styles.figmaMedicationHeaderRow}>
                <TouchableOpacity
                  onPress={() =>
                    params.returnTo === "track"
                      ? router.push("/(tabs)/track")
                      : router.back()
                  }
                  style={styles.figmaMedicationBackButton}
                >
                  <ArrowLeft color="#003543" size={20} />
                </TouchableOpacity>
                <View style={styles.figmaMedicationHeaderTitle}>
                  <View style={styles.figmaMedicationTitleRow}>
                    <Pill color="#EB9C0C" size={24} />
                    <Text style={styles.figmaMedicationTitle}>Medications</Text>
                  </View>
                  <Text style={styles.figmaMedicationSubtitle}>
                    Manage medication schedule
                  </Text>
                </View>
              </View>
            </View>
          </WavyBackground>
        </View>
        <FamilyDataFilter
          currentUserId={user.id}
          familyMembers={familyMembers}
          hasFamily={hasFamily}
          isAdmin={isAdmin}
          onFilterChange={handleFilterChange}
          selectedFilter={selectedFilter}
        />

        {dueToday > 0 && (
          <View style={styles.figmaMedicationAlertBanner}>
            <AlertCircle color="#DC2626" size={18} />
            <View style={styles.figmaMedicationAlertTextWrap}>
              <Text style={styles.figmaMedicationAlertTitle}>
                Doses due today
              </Text>
              <Text style={styles.figmaMedicationAlertText}>
                You have {dueToday} dose{dueToday === 1 ? "" : "s"} to take
                today.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.figmaMedicationStatsRow}>
          <View style={styles.figmaMedicationStatCard}>
            <Text style={styles.figmaMedicationStatValue}>
              {activeMedsCount}
            </Text>
            <Text style={styles.figmaMedicationStatLabel}>Active Meds</Text>
          </View>
          <View style={styles.figmaMedicationStatCard}>
            <View style={styles.figmaMedicationStatTrendRow}>
              <CheckCircle2 color="#10B981" size={14} />
              <Text
                style={[styles.figmaMedicationStatValue, { color: "#10B981" }]}
              >
                {adherence}%
              </Text>
            </View>
            <Text style={styles.figmaMedicationStatLabel}>Adherence</Text>
          </View>
          <View style={styles.figmaMedicationStatCard}>
            <Text style={styles.figmaMedicationStatValue}>{dueToday}</Text>
            <Text style={styles.figmaMedicationStatLabel}>Due Today</Text>
          </View>
        </View>

        <View style={styles.figmaMedicationSection}>
          <View style={styles.figmaMedicationSectionHeader}>
            <Text style={styles.figmaMedicationSectionTitle}>
              Active Medications
            </Text>
            <View style={styles.figmaMedicationSectionMeta}>
              <Text style={styles.figmaMedicationSectionLink}>Manage</Text>
              <ChevronRight color="#94A3B8" size={16} />
            </View>
          </View>
          <View style={styles.figmaMedicationList}>
            {displayMedications.length > 0 ? (
              displayMedications.map((medication) => {
                const reminders = Array.isArray(medication.reminders)
                  ? medication.reminders
                  : [];
                const visibleReminders = reminders.slice(0, 3);
                const extraReminders =
                  reminders.length > visibleReminders.length
                    ? reminders.length - visibleReminders.length
                    : 0;
                const canManage =
                  medication.userId === user.id ||
                  (isAdmin &&
                    (selectedFilter.type === "family" ||
                      selectedFilter.type === "member"));
                const accent = getMedicationAccent(medication.name);
                const takenToday =
                  reminders.length > 0 &&
                  reminders.every((reminder) => reminder.taken);
                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    key={medication.id}
                    onPress={() => {
                      if (canManage) {
                        Alert.alert(
                          medication.name,
                          isRTL
                            ? "ماذا تريد أن تفعل؟"
                            : "What would you like to do?",
                          [
                            {
                              text: isRTL ? "تعديل" : "Edit",
                              onPress: () => handleEditMedication(medication),
                            },
                            {
                              text: isRTL ? "حذف" : "Delete",
                              style: "destructive",
                              onPress: () => handleDeleteMedication(medication),
                            },
                            {
                              text: isRTL ? "إلغاء" : "Cancel",
                              style: "cancel",
                            },
                          ]
                        );
                      }
                    }}
                    style={styles.figmaMedicationCard}
                  >
                    <View style={styles.figmaMedicationCardHeader}>
                      <View
                        style={[
                          styles.figmaMedicationIconWrap,
                          { backgroundColor: `${accent}15` },
                        ]}
                      >
                        <Pill color={accent} size={24} />
                      </View>
                      <View style={styles.figmaMedicationCardInfo}>
                        <View style={styles.figmaMedicationCardTopRow}>
                          <Text style={styles.figmaMedicationName}>
                            {medication.name}
                          </Text>
                          {takenToday ? (
                            <CheckCircle2 color="#10B981" size={20} />
                          ) : (
                            <AlertCircle color="#F97316" size={20} />
                          )}
                        </View>
                        <Text style={styles.figmaMedicationDosage}>
                          {medication.dosage || "Dose not set"} •{" "}
                          {medication.frequency}
                        </Text>
                        {(selectedFilter.type === "family" ||
                          selectedFilter.type === "member") && (
                          <Text style={styles.figmaMedicationMemberTag}>
                            {getMemberName(medication.userId)}
                          </Text>
                        )}
                        {medication.tags && medication.tags.length > 0 && (
                          <View style={styles.figmaMedicationTags}>
                            {medication.tags.slice(0, 3).map((tag) => (
                              <Badge
                                key={`${medication.id}-${tag}`}
                                size="small"
                                style={styles.figmaMedicationTag}
                                variant="outline"
                              >
                                <Text style={styles.figmaMedicationTagText}>
                                  {tag}
                                </Text>
                              </Badge>
                            ))}
                            {medication.tags.length > 3 && (
                              <Text style={styles.figmaMedicationMoreTags}>
                                +{medication.tags.length - 3}
                              </Text>
                            )}
                          </View>
                        )}
                        <View style={styles.figmaMedicationMetaRow}>
                          <Clock color="#6C7280" size={12} />
                          <Text style={styles.figmaMedicationMetaText}>
                            {getNextDoseText(medication)}
                          </Text>
                        </View>
                      </View>
                      <ChevronRight color="#94A3B8" size={20} />
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.figmaMedicationEmpty}>
                No medications added yet
              </Text>
            )}
          </View>
        </View>

        <View style={styles.figmaMedicationSection}>
          <View style={styles.figmaMedicationSectionHeader}>
            <Text style={styles.figmaMedicationSectionTitle}>
              Upcoming Doses
            </Text>
            <Bell color="#003543" size={18} />
          </View>
          {upcomingDoses.length > 0 ? (
            <View style={styles.figmaMedicationUpcomingList}>
              {upcomingDoses.map(({ medication, reminder }) => {
                const canMarkTaken =
                  medication.userId === user.id || (isAdmin && user.familyId);
                const reminderId = reminder.id;
                const accent = getMedicationAccent(medication.name);
                const memberLabel =
                  selectedFilter.type === "personal"
                    ? ""
                    : ` - ${getMemberName(medication.userId)}`;
                const timeUntil = getTimeUntil(reminder.time);
                return (
                  <View
                    key={`${medication.id}-${reminder.time}`}
                    style={styles.figmaMedicationUpcomingRow}
                  >
                    <View style={styles.figmaMedicationUpcomingLeft}>
                      <View
                        style={[
                          styles.figmaMedicationUpcomingIcon,
                          { backgroundColor: `${accent}15` },
                        ]}
                      >
                        <Bell color={accent} size={16} />
                      </View>
                      <View>
                        <Text style={styles.figmaMedicationUpcomingName}>
                          {medication.name} {medication.dosage || ""}
                        </Text>
                        <Text style={styles.figmaMedicationUpcomingDetail}>
                          {convertTo12Hour(reminder.time)}
                          {timeUntil ? ` - in ${timeUntil}` : ""}
                          {memberLabel}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      disabled={!(canMarkTaken && reminderId)}
                      onPress={() =>
                        reminderId &&
                        toggleMedicationTaken(medication.id, reminderId)
                      }
                      style={[
                        styles.figmaMedicationMarkButton,
                        !(canMarkTaken && reminderId) &&
                          styles.figmaMedicationMarkButtonDisabled,
                      ]}
                    >
                      <Text style={styles.figmaMedicationMarkButtonText}>
                        Mark Taken
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.figmaMedicationEmpty}>No upcoming doses</Text>
          )}
        </View>

        <View style={styles.figmaMedicationSection}>
          <View style={styles.figmaMedicationSectionHeader}>
            <Text style={styles.figmaMedicationSectionTitle}>
              Recent History
            </Text>
            <Calendar color="#003543" size={18} />
          </View>
          {recentHistory.length > 0 ? (
            <View style={styles.figmaMedicationHistoryList}>
              {recentHistory.map(({ medication, reminder }) => {
                const accent = getMedicationAccent(medication.name);
                const memberLabel =
                  selectedFilter.type === "personal"
                    ? ""
                    : ` - ${getMemberName(medication.userId)}`;
                const status = reminder.taken ? "Taken" : "Missed";
                return (
                  <View
                    key={`${medication.id}-${reminder.time}-taken`}
                    style={styles.figmaMedicationHistoryRow}
                  >
                    <View
                      style={[
                        styles.figmaMedicationHistoryIcon,
                        { backgroundColor: `${accent}15` },
                      ]}
                    >
                      {reminder.taken ? (
                        <CheckCircle2 color={accent} size={16} />
                      ) : (
                        <AlertCircle color="#EF4444" size={16} />
                      )}
                    </View>
                    <View style={styles.figmaMedicationHistoryInfo}>
                      <Text style={styles.figmaMedicationHistoryName}>
                        {medication.name} {medication.dosage || ""}
                      </Text>
                      <Text style={styles.figmaMedicationHistoryDetail}>
                        {convertTo12Hour(reminder.time)}
                        {memberLabel}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.figmaMedicationHistoryStatus,
                        reminder.taken
                          ? styles.figmaMedicationHistoryStatusTaken
                          : styles.figmaMedicationHistoryStatusMissed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.figmaMedicationHistoryStatusText,
                          reminder.taken
                            ? styles.figmaMedicationHistoryStatusTextTaken
                            : styles.figmaMedicationHistoryStatusTextMissed,
                        ]}
                      >
                        {status}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.figmaMedicationEmpty}>No recent doses</Text>
          )}
        </View>

        {selectedFilter.type === "personal" && (
          <View style={styles.figmaMedicationSection}>
            <MedicationRefillCard refillSummary={refillSummary} />
          </View>
        )}

        <View style={styles.figmaMedicationSection}>
          <MedicationInteractionWarning medications={displayMedications} />
        </View>
      </ScrollView>

      <View collapsable={false} ref={addMedicationButtonRef}>
        <TouchableOpacity
          onPress={() => {
            setNewMedication({
              name: "",
              dosage: "",
              frequency: "",
              reminders: [{ time: "", period: "AM" }],
              notes: "",
              quantity: undefined,
              quantityUnit: "pills",
              lastRefillDate: undefined,
              refillReminderDays: 7,
              tags: [],
            });
            setSelectedTargetUser(user.id);
            setMedicationSuggestions([]);
            setShowSuggestions(false);
            setShowAddModal(true);
          }}
          style={styles.figmaMedicationFab}
        >
          <Plus color="#FFFFFF" size={22} />
        </TouchableOpacity>
      </View>

      <CoachMark
        body={
          isRTL
            ? "اضغط هنا لإضافة دواء وتتبع جدول الأدوية."
            : "Tap here to add a medication and track your schedule."
        }
        isRTL={isRTL}
        onClose={() => setShowHowTo(false)}
        onPrimaryAction={() => setShowAddModal(true)}
        primaryActionLabel={isRTL ? "إضافة دواء" : "Add medication"}
        secondaryActionLabel={isRTL ? "تم" : "Got it"}
        targetRef={addMedicationButtonRef}
        title={isRTL ? "تتبع الأدوية" : "Track medications"}
        visible={showHowTo}
      />

      {/* Add Medication Modal */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={showAddModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Heading
              level={5}
              style={[styles.modalTitle, isRTL && styles.rtlText]}
            >
              {editingMedication
                ? isRTL
                  ? "تحديث الدواء"
                  : "Edit Medication"
                : isRTL
                  ? "إضافة دواء"
                  : "Add Medication"}
            </Heading>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                setEditingMedication(null);
                setNewMedication({
                  name: "",
                  dosage: "",
                  frequency: "",
                  reminders: [{ time: "", period: "AM" }],
                  notes: "",
                  quantity: undefined,
                  quantityUnit: "pills",
                  lastRefillDate: undefined,
                  refillReminderDays: 7,
                  tags: [],
                });
                setMedicationSuggestions([]);
                setShowSuggestions(false);
              }}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            style={styles.modalContent}
          >
            {/* Target User Selector (for admins) */}
            {isAdmin && hasFamily && familyMembers.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "إضافة الدواء لـ" : "Add medication for"}
                </Text>
                <View style={styles.memberSelectionContainer}>
                  {familyMembers.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      onPress={() => setSelectedTargetUser(member.id)}
                      style={[
                        styles.memberOption,
                        selectedTargetUser === member.id &&
                          styles.memberOptionSelected,
                      ]}
                    >
                      <View style={styles.memberInfo}>
                        <Text
                          style={[
                            styles.memberName,
                            selectedTargetUser === member.id &&
                              styles.memberNameSelected,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {member.id === user.id
                            ? isRTL
                              ? "أنت"
                              : "You"
                            : member.firstName && member.lastName
                              ? `${member.firstName} ${member.lastName}`
                              : member.firstName || "User"}
                        </Text>
                        {member.role === "admin" && (
                          <Text
                            style={[
                              styles.memberRole,
                              selectedTargetUser === member.id &&
                                styles.memberRoleSelected,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {isRTL ? "مدير" : "Admin"}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Medication Name */}
            <View style={styles.fieldContainer}>
              <Input
                error={undefined}
                helperText={undefined}
                label={`${t("medicationName")} *`}
                leftIcon={undefined}
                onBlur={() => {
                  // Clear any existing timeout
                  if (blurTimeoutRef.current) {
                    clearTimeout(blurTimeoutRef.current);
                  }
                  // Delay hiding suggestions to allow for selection
                  blurTimeoutRef.current = setTimeout(() => {
                    setShowSuggestions(false);
                    blurTimeoutRef.current = null;
                  }, 300);
                }}
                onChangeText={(text: string) => {
                  setNewMedication({ ...newMedication, name: text });
                  if (suggestionsDebounceRef.current) {
                    clearTimeout(suggestionsDebounceRef.current);
                  }
                  if (text.trim().length === 0) {
                    applyMedicationSuggestions("");
                    return;
                  }
                  // Debounce filtering to reduce work on each keystroke
                  suggestionsDebounceRef.current = setTimeout(() => {
                    applyMedicationSuggestions(text);
                  }, 250);
                }}
                onFocus={() => {
                  // Clear any existing timeout when input is focused
                  if (blurTimeoutRef.current) {
                    clearTimeout(blurTimeoutRef.current);
                    blurTimeoutRef.current = null;
                  }
                  // Show suggestions when input is focused if there's text
                  if (newMedication.name.trim().length > 0) {
                    applyMedicationSuggestions(newMedication.name);
                  }
                }}
                placeholder={isRTL ? "اسم الدواء" : "Medication name"}
                rightIcon={undefined}
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={newMedication.name}
              />
              {showSuggestions && medicationSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    style={styles.suggestionsScrollView}
                  >
                    {medicationSuggestions.map((suggestion, index) => {
                      const commonDosage = MEDICATION_DOSAGES[suggestion];
                      const isLastItem =
                        index === medicationSuggestions.length - 1;
                      return (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          key={suggestion}
                          onPress={() => {
                            // Clear timeout when suggestion is selected
                            if (blurTimeoutRef.current) {
                              clearTimeout(blurTimeoutRef.current);
                              blurTimeoutRef.current = null;
                            }
                            // Only use suggested dosage if user hasn't entered a custom dosage yet
                            const dosageToSet =
                              commonDosage && !newMedication.dosage
                                ? commonDosage
                                : newMedication.dosage;
                            setNewMedication({
                              ...newMedication,
                              name: suggestion,
                              dosage: dosageToSet,
                            });
                            setShowSuggestions(false);
                            setMedicationSuggestions([]);
                          }}
                          style={[
                            styles.suggestionItem,
                            isLastItem && styles.suggestionItemLast,
                          ]}
                        >
                          <Text
                            style={[
                              styles.suggestionText,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {suggestion}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Dosage */}
            <View style={styles.fieldContainer}>
              <Input
                error={undefined}
                helperText={undefined}
                label={`${t("dosage")} *`}
                leftIcon={undefined}
                onChangeText={(text: string) =>
                  setNewMedication({ ...newMedication, dosage: text })
                }
                placeholder={
                  isRTL ? "مثال: 500mg, 1 كبسولة" : "e.g., 500mg, 1 tablet"
                }
                rightIcon={undefined}
                style={isRTL && styles.rtlInput}
                textAlign={isRTL ? "right" : "left"}
                value={newMedication.dosage}
              />
            </View>

            {/* Frequency */}
            <View style={styles.fieldContainer}>
              <Text
                style={[styles.fieldLabel, isRTL && styles.rtlText]}
                weight="semibold"
              >
                {t("frequency")} *
              </Text>
              <View style={styles.frequencyGrid}>
                {FREQUENCY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() =>
                      setNewMedication({
                        ...newMedication,
                        frequency: option.key,
                      })
                    }
                    style={[
                      styles.frequencyChip,
                      newMedication.frequency === option.key &&
                        styles.frequencyChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.frequencyChipText,
                        newMedication.frequency === option.key &&
                          styles.frequencyChipTextSelected,
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {isRTL ? option.labelAr : option.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Reminders */}
            <View style={styles.fieldContainer}>
              <Text
                style={[styles.fieldLabel, isRTL && styles.rtlText]}
                weight="semibold"
              >
                {isRTL ? "التذكيرات" : "Reminders"} *
              </Text>
              <Caption
                numberOfLines={undefined}
                style={[styles.helperText, isRTL && styles.rtlText]}
              >
                {isRTL
                  ? "أدخل الوقت واختر AM أو PM - مثال: 08:34 AM، 02:30 PM"
                  : "Enter time and select AM or PM - Examples: 08:34 AM, 02:30 PM"}
              </Caption>
              <View style={styles.remindersList}>
                {newMedication.reminders.map((reminder, index) => {
                  // Use the stored time and period values directly
                  // When editing, these are already parsed from 24-hour format
                  // When adding new, these start empty
                  const timeValue = reminder.time || "";
                  const periodValue: "AM" | "PM" = reminder.period || "AM";

                  return (
                    <View key={`reminder-${index}`} style={styles.reminderItem}>
                      <TextInput
                        keyboardType="number-pad"
                        maxLength={5}
                        onChangeText={(text) => {
                          // Remove all non-digits first
                          const digitsOnly = text.replace(/\D/g, "");

                          // Auto-format as HH:MM
                          let formatted = "";
                          if (digitsOnly.length > 0) {
                            // Add first digit
                            formatted = digitsOnly.substring(0, 1);
                            if (digitsOnly.length > 1) {
                              // Add second digit and colon
                              formatted = `${digitsOnly.substring(0, 2)}:`;
                              if (digitsOnly.length > 2) {
                                // Add minutes
                                formatted =
                                  digitsOnly.substring(0, 2) +
                                  ":" +
                                  digitsOnly.substring(2, 4);
                              }
                            }
                          }

                          // Limit to HH:MM format (max 5 characters: "12:34")
                          if (formatted.length <= 5) {
                            setNewMedication({
                              ...newMedication,
                              reminders: newMedication.reminders.map((r, i) =>
                                i === index
                                  ? {
                                      ...r,
                                      time: formatted,
                                      period: r.period || "AM",
                                    }
                                  : r
                              ),
                            });
                          }
                        }}
                        placeholder={isRTL ? "08:34" : "08:34"}
                        style={[
                          styles.reminderTimeInput,
                          isRTL && styles.rtlInput,
                        ]}
                        textAlign={isRTL ? "right" : "left"}
                        value={timeValue}
                      />
                      <View style={styles.periodSelector}>
                        <TouchableOpacity
                          onPress={() => {
                            setNewMedication({
                              ...newMedication,
                              reminders: newMedication.reminders.map((r, i) =>
                                i === index ? { ...r, period: "AM" } : r
                              ),
                            });
                          }}
                          style={[
                            styles.periodButton,
                            periodValue === "AM" && styles.periodButtonSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.periodButtonText,
                              periodValue === "AM" &&
                                styles.periodButtonTextSelected,
                            ]}
                          >
                            AM
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            setNewMedication({
                              ...newMedication,
                              reminders: newMedication.reminders.map((r, i) =>
                                i === index ? { ...r, period: "PM" } : r
                              ),
                            });
                          }}
                          style={[
                            styles.periodButton,
                            periodValue === "PM" && styles.periodButtonSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.periodButtonText,
                              periodValue === "PM" &&
                                styles.periodButtonTextSelected,
                            ]}
                          >
                            PM
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          setNewMedication({
                            ...newMedication,
                            reminders: newMedication.reminders.filter(
                              (_, i) => i !== index
                            ),
                          })
                        }
                        style={styles.removeButton}
                      >
                        <Minus color="#64748B" size={16} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
              <TouchableOpacity
                onPress={() =>
                  setNewMedication({
                    ...newMedication,
                    reminders: [
                      ...newMedication.reminders,
                      { time: "", period: "AM" },
                    ],
                  })
                }
                style={styles.addButton}
              >
                <Plus color="#64748B" size={24} />
              </TouchableOpacity>
            </View>

            {/* Quantity Tracking (Optional) */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "تتبع الكمية" : "Quantity Tracking"} (
                {isRTL ? "اختياري" : "Optional"})
              </Text>
              <View style={styles.quantityRow}>
                <View style={styles.quantityInputContainer}>
                  <Input
                    error={undefined}
                    helperText={undefined}
                    keyboardType="numeric"
                    label={isRTL ? "الكمية" : "Quantity"}
                    leftIcon={undefined}
                    onChangeText={(text: string) => {
                      const num = text ? Number.parseInt(text, 10) : undefined;
                      setNewMedication({
                        ...newMedication,
                        quantity: num && !Number.isNaN(num) ? num : undefined,
                      });
                    }}
                    placeholder={isRTL ? "30" : "30"}
                    rightIcon={undefined}
                    style={[styles.quantityInput, isRTL && styles.rtlInput]}
                    textAlign={isRTL ? "right" : "left"}
                    value={
                      newMedication.quantity !== undefined
                        ? newMedication.quantity.toString()
                        : ""
                    }
                  />
                </View>
                <View style={styles.unitInputContainer}>
                  <Input
                    error={undefined}
                    helperText={undefined}
                    label={isRTL ? "الوحدة" : "Unit"}
                    leftIcon={undefined}
                    onChangeText={(text: string) =>
                      setNewMedication({
                        ...newMedication,
                        quantityUnit: text || "pills",
                      })
                    }
                    placeholder={isRTL ? "حبة" : "pills"}
                    rightIcon={undefined}
                    style={[styles.unitInput, isRTL && styles.rtlInput]}
                    textAlign={isRTL ? "right" : "left"}
                    value={newMedication.quantityUnit}
                  />
                </View>
              </View>
              <Caption
                numberOfLines={undefined}
                style={[styles.helperText, isRTL && styles.rtlText]}
              >
                {isRTL
                  ? "عدد الحبات/الكمية الحالية المتوفرة"
                  : "Current quantity available (e.g., number of pills)"}
              </Caption>
            </View>

            {/* Refill Reminder Settings */}
            <View style={styles.fieldContainer}>
              <Input
                error={undefined}
                helperText={undefined}
                keyboardType="numeric"
                label={`${isRTL ? "تنبيه قبل" : "Remind me"} (${isRTL ? "أيام" : "days"})`}
                leftIcon={undefined}
                onChangeText={(text: string) => {
                  const num = text ? Number.parseInt(text, 10) : 7;
                  setNewMedication({
                    ...newMedication,
                    refillReminderDays: num && !Number.isNaN(num) ? num : 7,
                  });
                }}
                placeholder="7"
                rightIcon={undefined}
                style={[styles.input, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={newMedication.refillReminderDays.toString()}
              />
              <Caption
                numberOfLines={undefined}
                style={[styles.helperText, isRTL && styles.rtlText]}
              >
                {isRTL
                  ? "عدد الأيام قبل نفاد الدواء لإرسال تنبيه"
                  : "Days before running out to send reminder"}
              </Caption>
            </View>

            {/* Tags */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "العلامات" : "Tags"} ({isRTL ? "اختياري" : "Optional"})
              </Text>
              <TagInput
                maxTags={10}
                onChangeTags={(tags) =>
                  setNewMedication({ ...newMedication, tags })
                }
                placeholder={
                  isRTL
                    ? "أضف علامات للتنظيم (مثل: صباحي، مزمن، طوارئ)"
                    : "Add tags for organization (e.g., morning, chronic, emergency)"
                }
                showSuggestions={true}
                tags={newMedication.tags}
              />
            </View>

            {/* Notes */}
            <View style={styles.fieldContainer}>
              <Input
                error={undefined}
                helperText={undefined}
                label={`${isRTL ? "ملاحظات" : "Notes"} (${isRTL ? "اختياري" : "Optional"})`}
                leftIcon={undefined}
                multiline
                numberOfLines={3}
                onChangeText={(text: string) =>
                  setNewMedication({ ...newMedication, notes: text })
                }
                placeholder={isRTL ? "أضف ملاحظات..." : "Add notes..."}
                rightIcon={undefined}
                style={[styles.textArea, isRTL && styles.rtlInput]}
                textAlign={isRTL ? "right" : "left"}
                value={newMedication.notes}
              />
            </View>

            {/* Submit Button */}
            <Button
              disabled={loading}
              fullWidth
              loading={loading}
              onPress={handleAddMedication}
              style={styles.submitButton}
              textStyle={undefined}
              title={
                loading ? (isRTL ? "جاري الإضافة..." : "Adding...") : t("add")
              }
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Bulk Import Modal */}
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  figmaMedicationHeaderWrap: {
    marginHorizontal: -24,
    marginTop: -16,
    marginBottom: 16,
  },
  figmaMedicationHeaderContent: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 12,
  },
  figmaMedicationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  figmaMedicationBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0, 53, 67, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaMedicationHeaderTitle: {
    flex: 1,
  },
  figmaMedicationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  figmaMedicationTitle: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: "#003543",
  },
  figmaMedicationSubtitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#003543",
    marginTop: 4,
  },
  figmaMedicationAddButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EB9C0C",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaMedicationFab: {
    position: "absolute",
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#D48A00",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  figmaMedicationHeaderStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  figmaMedicationHeaderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  figmaMedicationHeaderChipText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: "#003543",
  },
  figmaMedicationContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 140,
  },
  figmaMedicationAlertBanner: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFF1F2",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 16,
  },
  figmaMedicationAlertTextWrap: {
    flex: 1,
  },
  figmaMedicationAlertTitle: {
    fontSize: 14,
    fontFamily: "Inter-Bold",
    color: "#991B1B",
    marginBottom: 4,
  },
  figmaMedicationAlertText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#B91C1C",
  },
  figmaMedicationStatsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  figmaMedicationStatCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  figmaMedicationStatValue: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: "#003543",
    marginBottom: 4,
  },
  figmaMedicationStatLabel: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: "#6C7280",
  },
  figmaMedicationStatTrendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  figmaMedicationSection: {
    marginBottom: 24,
  },
  figmaMedicationSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  figmaMedicationSectionTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
  },
  figmaMedicationSectionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  figmaMedicationSectionLink: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#003543",
  },
  figmaMedicationList: {
    gap: 12,
  },
  figmaMedicationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  figmaMedicationCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  figmaMedicationIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  figmaMedicationCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  figmaMedicationCardInfo: {
    flex: 1,
  },
  figmaMedicationName: {
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
  },
  figmaMedicationMemberTag: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
  },
  figmaMedicationDosage: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
    marginTop: 2,
  },
  figmaMedicationTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  figmaMedicationTag: {
    borderColor: "#E2E8F0",
  },
  figmaMedicationTagText: {
    fontSize: 10,
    fontFamily: "Inter-Medium",
    color: "#0F766E",
  },
  figmaMedicationMoreTags: {
    fontSize: 10,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
  },
  figmaMedicationMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  figmaMedicationMetaText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
  },
  figmaMedicationActions: {
    flexDirection: "row",
    gap: 8,
  },
  figmaMedicationActionButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  figmaMedicationActionButtonDanger: {
    backgroundColor: "#FEF2F2",
  },
  figmaMedicationReminders: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
    alignItems: "flex-start",
  },
  figmaMedicationReminderButton: {
    marginBottom: 0,
  },
  figmaMedicationReminderMore: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaMedicationReminderMoreText: {
    fontSize: 10,
    fontFamily: "Inter-SemiBold",
    color: "#6C7280",
  },
  figmaMedicationManageRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  figmaMedicationManageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  figmaMedicationManageButtonDanger: {
    backgroundColor: "#FEF2F2",
  },
  figmaMedicationManageText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: "#6C7280",
  },
  figmaMedicationManageTextDanger: {
    color: "#EF4444",
  },
  figmaMedicationEmpty: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
  },
  figmaMedicationUpcomingList: {
    gap: 12,
  },
  figmaMedicationUpcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  figmaMedicationUpcomingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  figmaMedicationUpcomingIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  figmaMedicationUpcomingName: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
  },
  figmaMedicationUpcomingDetail: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
    marginTop: 2,
  },
  figmaMedicationQuickButton: {
    marginLeft: 12,
  },
  figmaMedicationMarkButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(0, 53, 67, 0.1)",
  },
  figmaMedicationMarkButtonDisabled: {
    opacity: 0.5,
  },
  figmaMedicationMarkButtonText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#003543",
  },
  figmaMedicationHistoryList: {
    gap: 10,
  },
  figmaMedicationHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  figmaMedicationHistoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  figmaMedicationHistoryInfo: {
    flex: 1,
  },
  figmaMedicationHistoryName: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#1A1D1F",
  },
  figmaMedicationHistoryDetail: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
    marginTop: 2,
  },
  figmaMedicationHistoryStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  figmaMedicationHistoryStatusTaken: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  figmaMedicationHistoryStatusMissed: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  figmaMedicationHistoryStatusText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
  },
  figmaMedicationHistoryStatusTextTaken: {
    color: "#10B981",
  },
  figmaMedicationHistoryStatusTextMissed: {
    color: "#EF4444",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonRTL: {
    // RTL adjustments if needed
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter-Bold",
    color: "#1E293B",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  headerHelpButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#003543",
    justifyContent: "center",
    alignItems: "center",
  },
  headerAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#003543",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 12,
  },
  progressInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressText: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: "#10B981",
    minWidth: 80,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 12,
  },
  sectionTitleRTL: {
    textAlign: "right",
  },
  medicationsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  medicationItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  medicationLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  medicationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginEnd: 12,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 2,
  },
  medicationDosage: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginBottom: 4,
  },
  medicationTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  medicationTimeText: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#64748B",
  },
  reminderButton: {
    marginBottom: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#374151",
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginBottom: 8,
    marginTop: -4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    backgroundColor: "#FFFFFF",
  },
  quantityRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  quantityInputContainer: {
    flex: 1,
  },
  quantityInput: {
    flex: 1,
  },
  unitInputContainer: {
    flex: 1,
  },
  unitInput: {
    flex: 1,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    backgroundColor: "#FFFFFF",
    textAlignVertical: "top",
    minHeight: 80,
  },
  rtlInput: {
    fontFamily: "Inter-Regular",
  },
  frequencyGrid: {
    flexDirection: "row",
    gap: 8,
  },
  frequencyChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  frequencyChipSelected: {
    backgroundColor: "#003543",
    borderColor: "#003543",
  },
  frequencyChipText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  frequencyChipTextSelected: {
    color: "#FFFFFF",
  },
  submitButton: {
    backgroundColor: "#003543",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: "#E2E8F0",
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    textAlign: "center",
  },
  rtlText: {
    textAlign: "right",
    fontFamily: "Inter-Regular",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    textAlign: "center",
  },
  medicationActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  deleteButton: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  remindersList: {
    marginBottom: 8,
  },
  reminderItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  reminderInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    backgroundColor: "#FFFFFF",
  },
  reminderTimeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    backgroundColor: "#FFFFFF",
    minWidth: 80,
  },
  periodSelector: {
    flexDirection: "row",
    gap: 4,
  },
  periodButton: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    minWidth: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  periodButtonSelected: {
    backgroundColor: "#003543",
    borderColor: "#003543",
  },
  periodButtonText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  periodButtonTextSelected: {
    color: "#FFFFFF",
  },
  removeButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  addButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  remindersDisplay: {
    flexDirection: "column",
    gap: 4,
    marginEnd: 8,
  },
  reminderTimeText: {
    fontSize: 10,
    fontFamily: "Inter-Regular",
    color: "#64748B",
    marginTop: 2,
  },
  reminderTimeTaken: {
    color: "#FFFFFF",
  },
  medicationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  memberBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  memberBadgeText: {
    fontSize: 10,
    fontFamily: "Inter-Medium",
    color: "#6366F1",
  },
  // Member selection styles
  memberSelectionContainer: {
    gap: 8,
  },
  memberOption: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberOptionSelected: {
    backgroundColor: "rgba(0, 53, 67, 0.08)",
    borderColor: "#003543",
  },
  memberInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberName: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#1E293B",
  },
  memberNameSelected: {
    color: "#003543",
  },
  memberRole: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  memberRoleSelected: {
    color: "#003543",
    backgroundColor: "rgba(0, 53, 67, 0.08)",
  },
  suggestionsContainer: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
  suggestionsScrollView: {
    maxHeight: 200,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: "#1E293B",
  },
  medicationTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
    alignItems: "center",
  },
  medicationTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  medicationTagText: {
    fontSize: 10,
    fontFamily: "Inter-Medium",
  },
  moreTagsText: {
    fontSize: 10,
    color: "#64748B",
    marginLeft: 4,
  },
});
