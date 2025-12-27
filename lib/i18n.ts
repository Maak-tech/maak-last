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

      // Mood types - Positive
      veryHappy: "Very Happy",
      happy: "Happy",
      excited: "Excited",
      content: "Content",
      grateful: "Grateful",
      hopeful: "Hopeful",
      proud: "Proud",
      calm: "Calm",
      peaceful: "Peaceful",
      // Mood types - Negative
      sad: "Sad",
      verySad: "Very Sad",
      anxious: "Anxious",
      angry: "Angry",
      frustrated: "Frustrated",
      overwhelmed: "Overwhelmed",
      hopeless: "Hopeless",
      guilty: "Guilty",
      ashamed: "Ashamed",
      lonely: "Lonely",
      irritable: "Irritable",
      restless: "Restless",
      stressed: "Stressed",
      // Mood types - Neutral/Other
      neutral: "Neutral",
      confused: "Confused",
      numb: "Numb",
      detached: "Detached",
      empty: "Empty",
      apathetic: "Apathetic",
      tired: "Tired",
      notes: "Notes",
      thisWeek: "This Week",

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

      // Subscription
      subscription: "Subscription",
      premium: "Premium",
      subscribe: "Subscribe",
      manageSubscription: "Manage Subscription",
      restorePurchases: "Restore Purchases",
      subscriptionActive: "Subscription Active",
      subscriptionInactive: "No Active Subscription",
      familyPlan: "Family Plan",
      individualPlan: "Individual Plan",
      monthly: "Monthly",
      yearly: "Yearly",
      planLimits: "Plan Limits",
      maxFamilyMembers: "Max Family Members",
      maxTotalMembers: "Max Total Members",
      individualPlanDescription: "1 admin + 1 family member",
      familyPlanDescription: "1 admin + 3 family members",
      purchaseSuccess: "Purchase Successful",
      purchaseSuccessMessage: "Your subscription has been activated successfully!",
      purchaseError: "Purchase Failed",
      purchaseErrorMessage: "There was an error processing your purchase. Please try again.",
      restoreSuccess: "Purchases Restored",
      restoreSuccessMessage: "Your purchases have been restored successfully.",
      loadError: "Failed to load subscription information. Please try again.",
      noOfferingsAvailable: "No subscription options are currently available.",
      noCustomerInfo: "Unable to load customer information.",
      subscriptionError: "An error occurred",
      errorMessage: "Something went wrong. Please try again.",
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

      // Mood types - Positive
      veryHappy: "سعيد جداً",
      happy: "سعيد",
      excited: "متحمس",
      content: "راضٍ",
      grateful: "ممتن",
      hopeful: "متفائل",
      proud: "فخور",
      calm: "هادئ",
      peaceful: "مطمئن",
      // Mood types - Negative
      sad: "حزين",
      verySad: "حزين جداً",
      anxious: "قلق",
      angry: "غاضب",
      frustrated: "محبط",
      overwhelmed: "مثقل",
      hopeless: "يائس",
      guilty: "شاعر بالذنب",
      ashamed: "خجلان",
      lonely: "وحيد",
      irritable: "عصبي",
      restless: "قلق",
      stressed: "متوتر",
      // Mood types - Neutral/Other
      neutral: "عادي",
      confused: "محتار",
      numb: "خدر",
      detached: "منفصل",
      empty: "فارغ",
      apathetic: "غير مبال",
      tired: "متعب",
      notes: "ملاحظات",
      thisWeek: "هذا الأسبوع",

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

      // Subscription
      subscription: "الاشتراك",
      premium: "مميز",
      subscribe: "اشترك",
      manageSubscription: "إدارة الاشتراك",
      restorePurchases: "استعادة المشتريات",
      subscriptionActive: "الاشتراك نشط",
      subscriptionInactive: "لا يوجد اشتراك نشط",
      familyPlan: "خطة العائلة",
      individualPlan: "الخطة الفردية",
      monthly: "شهري",
      yearly: "سنوي",
      planLimits: "حدود الخطة",
      maxFamilyMembers: "الحد الأقصى لأفراد العائلة",
      maxTotalMembers: "الحد الأقصى لإجمالي الأعضاء",
      individualPlanDescription: "مدير واحد + فرد واحد من العائلة",
      familyPlanDescription: "مدير واحد + 3 أفراد من العائلة",
      purchaseSuccess: "تم الشراء بنجاح",
      purchaseSuccessMessage: "تم تفعيل اشتراكك بنجاح!",
      purchaseError: "فشل الشراء",
      purchaseErrorMessage: "حدث خطأ أثناء معالجة عملية الشراء. يرجى المحاولة مرة أخرى.",
      restoreSuccess: "تم استعادة المشتريات",
      restoreSuccessMessage: "تم استعادة مشترياتك بنجاح.",
      loadError: "فشل تحميل معلومات الاشتراك. يرجى المحاولة مرة أخرى.",
      noOfferingsAvailable: "لا توجد خيارات اشتراك متاحة حالياً.",
      noCustomerInfo: "تعذر تحميل معلومات العميل.",
      subscriptionError: "حدث خطأ",
      errorMessage: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
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
