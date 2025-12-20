import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      // Common
      welcome: "Welcome",
      continue: "Continue",
      skip: "Skip",
      next: "Next",
      back: "Back",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      add: "Add",
      loading: "Loading...",
      error: "Error",
      success: "Success",

      // Auth
      signIn: "Sign In",
      signUp: "Sign Up",
      signOut: "Sign Out",
      email: "Email",
      password: "Password",
      confirmPassword: "Confirm Password",
      forgotPassword: "Forgot Password?",
      createAccount: "Create Account",
      alreadyHaveAccount: "Already have an account?",
      dontHaveAccount: "Don't have an account?",

      // Onboarding
      onboardingTitle1: "Track Your Health",
      onboardingDesc1:
        "Monitor your symptoms, medications, and vitals in one place",
      onboardingTitle2: "Family Care",
      onboardingDesc2: "Keep your entire family healthy with shared monitoring",
      onboardingTitle3: "Smart Alerts",
      onboardingDesc3: "Get timely reminders and emergency notifications",

      // Navigation
      dashboard: "Dashboard",
      symptoms: "Symptoms",
      medications: "Medications",
      family: "Family",
      profile: "Profile",

      // Dashboard
      healthOverview: "Health Overview",
      recentSymptoms: "Recent Symptoms",
      upcomingMeds: "Upcoming Medications",
      familyAlerts: "Family Alerts",

      // Symptoms
      logSymptom: "Log Symptom",
      symptomType: "Symptom Type",
      severity: "Severity",
      description: "Description",
      painLevel: "Pain Level",

      // Medications
      addMedication: "Add Medication",
      medicationName: "Medication Name",
      dosage: "Dosage",
      frequency: "Frequency",
      setReminder: "Set Reminder",

      // Family
      inviteFamily: "Invite Family Member",
      familyMembers: "Family Members",
      healthStatus: "Health Status",

      // Common symptoms
      headache: "Headache",
      fever: "Fever",
      cough: "Cough",
      fatigue: "Fatigue",
      nausea: "Nausea",
      dizziness: "Dizziness",
      chestPain: "Chest Pain",
      backPain: "Back Pain",
      soreThroat: "Sore Throat",
      runnyNose: "Runny Nose",
      shortnessOfBreath: "Shortness of Breath",
      muscleAche: "Muscle Ache",
      jointPain: "Joint Pain",
      stomachPain: "Stomach Pain",
      diarrhea: "Diarrhea",
      constipation: "Constipation",
      insomnia: "Insomnia",
      anxiety: "Anxiety",
      depression: "Depression",
      rash: "Rash",
      itchiness: "Itchiness",
      swelling: "Swelling",
      chills: "Chills",
      sweating: "Sweating",
      lossOfAppetite: "Loss of Appetite",
      blurredVision: "Blurred Vision",
      ringingInEars: "Ringing in Ears",
      numbness: "Numbness",

      // Severity levels
      mild: "Mild",
      moderate: "Moderate",
      severe: "Severe",
      verySevere: "Very Severe",

      // Relations
      father: "Father",
      mother: "Mother",
      spouse: "Spouse",
      child: "Child",
      sibling: "Sibling",
      grandparent: "Grandparent",
      other: "Other",

      // Profile
      personalInformation: "Personal Information",
      medicalHistory: "Medical History",
      healthReports: "Health Reports",
      helpSupport: "Help & Support",
      termsConditions: "Terms & Conditions",
      privacyPolicy: "Privacy Policy",
      healthScore: "Health Score",
      symptomsThisMonth: "Symptoms This Month",
      activeMedications: "Active Medications",
      notifications: "Notifications",
      fallDetection: "Fall Detection",
      language: "Language",
      comingSoon: "Coming Soon",
      ok: "OK",
    },
  },
  ar: {
    translation: {
      // Common
      welcome: "مرحباً",
      continue: "متابعة",
      skip: "تخطي",
      next: "التالي",
      back: "رجوع",
      save: "حفظ",
      cancel: "إلغاء",
      delete: "حذف",
      edit: "تعديل",
      add: "إضافة",
      loading: "جاري التحميل...",
      error: "خطأ",
      success: "نجح",

      // Auth
      signIn: "تسجيل الدخول",
      signUp: "إنشاء حساب",
      signOut: "تسجيل الخروج",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      confirmPassword: "تأكيد كلمة المرور",
      forgotPassword: "نسيت كلمة المرور؟",
      createAccount: "إنشاء حساب",
      alreadyHaveAccount: "لديك حساب بالفعل؟",
      dontHaveAccount: "ليس لديك حساب؟",

      // Onboarding
      onboardingTitle1: "تتبع صحتك",
      onboardingDesc1: "راقب أعراضك وأدويتك وعلاماتك الحيوية في مكان واحد",
      onboardingTitle2: "رعاية العائلة",
      onboardingDesc2: "حافظ على صحة عائلتك بالكامل مع المراقبة المشتركة",
      onboardingTitle3: "تنبيهات ذكية",
      onboardingDesc3: "احصل على تذكيرات في الوقت المناسب وإشعارات الطوارئ",

      // Navigation
      dashboard: "لوحة التحكم",
      symptoms: "الأعراض",
      medications: "الأدوية",
      family: "العائلة",
      profile: "الملف الشخصي",

      // Dashboard
      healthOverview: "نظرة عامة على الصحة",
      recentSymptoms: "الأعراض الأخيرة",
      upcomingMeds: "الأدوية القادمة",
      familyAlerts: "تنبيهات العائلة",

      // Symptoms
      logSymptom: "تسجيل عرض",
      symptomType: "نوع العرض",
      severity: "الشدة",
      description: "الوصف",
      painLevel: "مستوى الألم",

      // Medications
      addMedication: "إضافة دواء",
      medicationName: "اسم الدواء",
      dosage: "الجرعة",
      frequency: "التكرار",
      setReminder: "تعيين تذكير",

      // Family
      inviteFamily: "دعوة فرد من العائلة",
      familyMembers: "أفراد العائلة",
      healthStatus: "الحالة الصحية",

      // Common symptoms
      headache: "صداع",
      fever: "حمى",
      cough: "سعال",
      fatigue: "إرهاق",
      nausea: "غثيان",
      dizziness: "دوخة",
      chestPain: "ألم في الصدر",
      backPain: "ألم في الظهر",
      soreThroat: "التهاب الحلق",
      runnyNose: "سيلان الأنف",
      shortnessOfBreath: "ضيق في التنفس",
      muscleAche: "ألم في العضلات",
      jointPain: "ألم في المفاصل",
      stomachPain: "ألم في المعدة",
      diarrhea: "إسهال",
      constipation: "إمساك",
      insomnia: "أرق",
      anxiety: "قلق",
      depression: "اكتئاب",
      rash: "طفح جلدي",
      itchiness: "حكة",
      swelling: "تورم",
      chills: "قشعريرة",
      sweating: "تعرق",
      lossOfAppetite: "فقدان الشهية",
      blurredVision: "عدم وضوح الرؤية",
      ringingInEars: "طنين في الأذنين",
      numbness: "خدر",

      // Severity levels
      mild: "خفيف",
      moderate: "متوسط",
      severe: "شديد",
      verySevere: "شديد جداً",

      // Relations
      father: "الأب",
      mother: "الأم",
      spouse: "الزوج/الزوجة",
      child: "الطفل",
      sibling: "الأخ/الأخت",
      grandparent: "الجد/الجدة",
      other: "آخر",

      // Profile
      personalInformation: "المعلومات الشخصية",
      medicalHistory: "التاريخ الطبي",
      healthReports: "التقارير الصحية",
      helpSupport: "المساعدة والدعم",
      termsConditions: "الشروط والأحكام",
      privacyPolicy: "سياسة الخصوصية",
      healthScore: "نقاط الصحة",
      symptomsThisMonth: "أعراض هذا الشهر",
      activeMedications: "أدوية نشطة",
      notifications: "الإشعارات",
      fallDetection: "كشف السقوط",
      language: "اللغة",
      comingSoon: "قريباً",
      ok: "موافق",
    },
  },
};

// Initialize i18n with proper configuration for react-i18next
const initI18n = () => {
  i18n
    .use(initReactI18next) // Pass the i18n instance to react-i18next
    .init({
      compatibilityJSON: "v3", // Fix Intl.PluralRules compatibility
      resources,
      lng: "en", // Default to English for now
      fallbackLng: "en",

      interpolation: {
        escapeValue: false, // React already does escaping
      },

      // React Native specific options
      react: {
        useSuspense: false, // Disable suspense for React Native
      },

      // Cache configuration for React Native
      cache: {
        enabled: false, // Disable caching for now to avoid issues
      },
    })
    .catch((error) => {
      // Silently handle error
    });
};

// Initialize i18n
initI18n();

export default i18n;
