import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type Language = "en" | "ar";
type Direction = "ltr" | "rtl";

interface LanguageContextType {
  language: Language;
  direction: Direction;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // General
    "app.name": "Maak",
    "app.tagline": "Proactive care for families",
    "welcome.back": "Welcome back",
    "getting.started": "Getting Started",

    // Navigation
    "nav.home": "Home",
    "nav.alerts": "Alerts",
    "nav.zeina": "Zeina",
    "nav.care": "Care",
    "nav.settings": "Settings",

    // Onboarding
    "onboarding.title.1": "Proactive care for families",
    "onboarding.subtitle.1":
      "Monitor health trends and get AI-powered insights for your loved ones",
    "onboarding.title.2": "Connect health data",
    "onboarding.subtitle.2":
      "Link wearables and sensors to track vitals automatically",
    "onboarding.title.3": "Stay informed, stay calm",
    "onboarding.subtitle.3":
      "Get meaningful alerts with context, not just noise",
    "onboarding.title.4": "Meet Zeina, your care agent",
    "onboarding.subtitle.4": "AI assistance that turns insights into actions",
    "onboarding.next": "Next",
    "onboarding.get.started": "Get Started",
    "onboarding.skip": "Skip",

    // Home
    "home.today": "Today",
    "home.highlights": "Today's Highlights",
    "home.ask.zeina": "Ask Zeina",
    "home.latest.alerts": "Latest Alerts",
    "home.view.all": "View all",
    "home.stable": "Everything looks steady today",

    // Status
    "status.stable": "Stable",
    "status.monitor": "Monitor",
    "status.attention": "Needs Attention",

    // Alerts
    "alerts.title": "Alerts & Incidents",
    "alerts.filter.all": "All",
    "alerts.filter.critical": "Critical",
    "alerts.filter.important": "Important",
    "alerts.filter.info": "Info",
    "alert.acknowledge": "Acknowledge",
    "alert.escalate": "Escalate",
    "alert.add.note": "Add Note",

    // Zeina
    "zeina.greeting": "Hello! How can I help you today?",
    "zeina.ask.placeholder": "Ask Zeina anything...",
    "zeina.quick.summarize": "Summarize today",
    "zeina.quick.concerns": "Any concerns?",
    "zeina.quick.update": "Send caregiver update",
    "zeina.quick.medication": "Medication check",
    "zeina.disclaimer":
      "Not a medical diagnosis. For emergencies, call local emergency services.",

    // Settings
    "settings.language": "Language",
    "settings.notifications": "Notifications",
    "settings.privacy": "Privacy & Data",
    "settings.integrations": "Integrations",
    "settings.emergency": "Emergency Contacts",
    "settings.help": "Help & Support",
  },
  ar: {
    // General
    "app.name": "مَعَاك",
    "app.tagline": "رعاية استباقية للعائلات",
    "welcome.back": "أهلاً بعودتك",
    "getting.started": "البدء",

    // Navigation
    "nav.home": "الرئيسية",
    "nav.alerts": "التنبيهات",
    "nav.zeina": "زينة",
    "nav.care": "الرعاية",
    "nav.settings": "الإعدادات",

    // Onboarding
    "onboarding.title.1": "رعاية استباقية للعائلات",
    "onboarding.subtitle.1":
      "راقب الاتجاهات الصحية واحصل على رؤى مدعومة بالذكاء الاصطناعي لأحبائك",
    "onboarding.title.2": "ربط البيانات الصحية",
    "onboarding.subtitle.2":
      "اربط الأجهزة القابلة للارتداء وأجهزة الاستشعار لتتبع العلامات الحيوية تلقائياً",
    "onboarding.title.3": "ابق على اطلاع، ابق هادئاً",
    "onboarding.subtitle.3":
      "احصل على تنبيهات ذات مغزى مع السياق، وليس مجرد ضوضاء",
    "onboarding.title.4": "تعرف على زينة، وكيلة الرعاية الخاصة بك",
    "onboarding.subtitle.4":
      "مساعدة الذكاء الاصطناعي التي تحول الرؤى إلى إجراءات",
    "onboarding.next": "التالي",
    "onboarding.get.started": "ابدأ",
    "onboarding.skip": "تخطي",

    // Home
    "home.today": "اليوم",
    "home.highlights": "أبرز أحداث اليوم",
    "home.ask.zeina": "اسأل زينة",
    "home.latest.alerts": "آخر التنبيهات",
    "home.view.all": "عرض الكل",
    "home.stable": "كل شيء يبدو مستقراً اليوم",

    // Status
    "status.stable": "مستقر",
    "status.monitor": "المراقبة",
    "status.attention": "يحتاج انتباه",

    // Alerts
    "alerts.title": "التنبيهات والحوادث",
    "alerts.filter.all": "الكل",
    "alerts.filter.critical": "حرجة",
    "alerts.filter.important": "مهمة",
    "alerts.filter.info": "معلومات",
    "alert.acknowledge": "إقرار",
    "alert.escalate": "تصعيد",
    "alert.add.note": "إضافة ملاحظة",

    // Zeina
    "zeina.greeting": "مرحباً! كيف يمكنني مساعدتك اليوم؟",
    "zeina.ask.placeholder": "اسأل زينة أي شيء...",
    "zeina.quick.summarize": "تلخيص اليوم",
    "zeina.quick.concerns": "أي مخاوف؟",
    "zeina.quick.update": "إرسال تحديث لمقدم الرعاية",
    "zeina.quick.medication": "فحص الأدوية",
    "zeina.disclaimer":
      "ليس تشخيصاً طبياً. في حالات الطوارئ، اتصل بخدمات الطوارئ المحلية.",

    // Settings
    "settings.language": "اللغة",
    "settings.notifications": "الإشعارات",
    "settings.privacy": "الخصوصية والبيانات",
    "settings.integrations": "التكاملات",
    "settings.emergency": "جهات اتصال الطوارئ",
    "settings.help": "المساعدة والدعم",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const direction: Direction = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.setAttribute("lang", language);
  }, [direction, language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => translations[language][key] || key;

  return (
    <LanguageContext.Provider value={{ language, direction, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
