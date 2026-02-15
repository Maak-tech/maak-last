/**
 * Hardcoded Arabic translations
 * Use these instead of i18n translations to ensure Arabic displays correctly
 */

export const arabicText = {
  // Navigation
  home: "الرئيسية",
  track: "تتبع",
  zeina: "زينة",
  family: "العائلة",
  profile: "الملف الشخصي",

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

  // Health
  symptoms: "الأعراض الصحية",
  medications: "الأدوية",
  vitals: "العلامات الحيوية",
  allergies: "الحساسية",
  moods: "المزاج",

  // Test
  testArabic: "اختبار العربية",
  helloWorld: "مرحباً بالعالم",
};

// Helper function to get Arabic text
export function getArabicText(key: keyof typeof arabicText): string {
  return arabicText[key] || key;
}
