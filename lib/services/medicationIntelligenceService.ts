/**
 * Medication Intelligence Service
 *
 * Drug-drug interaction checking (static dataset), refill predictions, and
 * effectiveness correlation insights (vitals vs compliance days).
 * Premium Individual+ feature.
 */

import { api } from "@/lib/apiClient";
import type { Medication } from "@/types";

export type InteractionSeverity = "major" | "moderate" | "minor";

export type InteractionWarning = {
  drug1: string;
  drug2: string;
  severity: InteractionSeverity;
  description: string;
  descriptionAr: string;
  recommendation: string;
  recommendationAr: string;
};

export type RefillPrediction = {
  medicationId: string;
  name: string;
  daysRemaining: number;
  refillBy: Date;
  isUrgent: boolean; // <= 7 days
};

export type EffectivenessInsight = {
  medicationId: string;
  medicationName: string;
  metric: string;
  metricAr: string;
  takenAvg: number;
  missedAvg: number;
  insight: string;
  insightAr: string;
};

// ─── Brand name → generic name aliases ────────────────────────────────────────
// Keys must be lowercase. Values must match a drug1/drug2 entry below.
const BRAND_ALIASES: Record<string, string> = {
  // NSAIDs
  "advil": "ibuprofen",
  "nurofen": "ibuprofen",
  "brufen": "ibuprofen",
  "motrin": "ibuprofen",
  "voltaren": "diclofenac",
  "cataflam": "diclofenac",
  "celebrex": "celecoxib",
  "naprosyn": "naproxen",
  "aleve": "naproxen",
  "ponstan": "mefenamic acid",
  // Analgesics
  "tylenol": "paracetamol",
  "panadol": "paracetamol",
  "acetaminophen": "paracetamol",
  "ultram": "tramadol",
  "tramal": "tramadol",
  // Statins
  "lipitor": "atorvastatin",
  "crestor": "rosuvastatin",
  "zocor": "simvastatin",
  "mevacor": "lovastatin",
  "pravachol": "pravastatin",
  "lescol": "fluvastatin",
  "livalo": "pitavastatin",
  // Diabetes
  "glucophage": "metformin",
  "glucovance": "metformin",
  "diamicron": "gliclazide",
  "amaryl": "glimepiride",
  "glibenil": "glibenclamide",
  "januvia": "sitagliptin",
  "jardiance": "empagliflozin",
  "forxiga": "dapagliflozin",
  "victoza": "liraglutide",
  "ozempic": "semaglutide",
  // Antihypertensives
  "zestril": "lisinopril",
  "prinivil": "lisinopril",
  "norvasc": "amlodipine",
  "cozaar": "losartan",
  "diovan": "valsartan",
  "micardis": "telmisartan",
  "atacand": "candesartan",
  "tritace": "ramipril",
  "coversyl": "perindopril",
  "lasix": "furosemide",
  "aldactone": "spironolactone",
  "aldactazide": "spironolactone",
  "hctz": "hydrochlorothiazide",
  "lopressor": "metoprolol",
  "toprol": "metoprolol",
  "tenormin": "atenolol",
  "inderal": "propranolol",
  "calan": "verapamil",
  "isoptin": "verapamil",
  // Anticoagulants / antiplatelets
  "coumadin": "warfarin",
  "marevan": "warfarin",
  "plavix": "clopidogrel",
  "eliquis": "apixaban",
  "xarelto": "rivaroxaban",
  "pradaxa": "dabigatran",
  // Antibiotics
  "augmentin": "amoxicillin",
  "penicillin": "amoxicillin",
  "zithromax": "azithromycin",
  "biaxin": "clarithromycin",
  "cipro": "ciprofloxacin",
  "keflex": "cephalexin",
  "flagyl": "metronidazole",
  "doxycycline": "doxycycline",
  "erythrocin": "erythromycin",
  // Antidepressants / antipsychotics
  "prozac": "fluoxetine",
  "zoloft": "sertraline",
  "lexapro": "escitalopram",
  "cipralex": "escitalopram",
  "paxil": "paroxetine",
  "effexor": "venlafaxine",
  "cymbalta": "duloxetine",
  "wellbutrin": "bupropion",
  "abilify": "aripiprazole",
  "risperdal": "risperidone",
  "seroquel": "quetiapine",
  // Thyroid
  "synthroid": "levothyroxine",
  "levoxyl": "levothyroxine",
  "euthyrox": "levothyroxine",
  // GI
  "prilosec": "omeprazole",
  "losec": "omeprazole",
  "nexium": "esomeprazole",
  "prevacid": "lansoprazole",
  "protonix": "pantoprazole",
  "controloc": "pantoprazole",
  "zantac": "ranitidine",
  "pepcid": "famotidine",
  "maalox": "antacid",
  "gaviscon": "antacid",
  // Cardiac
  "lanoxin": "digoxin",
  "cordarone": "amiodarone",
  "pacerone": "amiodarone",
  // Supplements commonly co-prescribed
  "glucobay": "acarbose",
  "calcium carbonate": "calcium",
  "caltrate": "calcium",
  "calcivit": "calcium",
};

/** Resolves a medication name to its generic equivalent (lowercase) */
function normalizeMedName(name: string): string {
  const lower = name.toLowerCase().trim();
  // Remove dose suffixes like "10mg", "500 mg", "XR", "SR" etc.
  const stripped = lower.replace(/\s*\d+[\s.]?\s*(mg|mcg|g|iu|ml|%|xr|sr|er|xl|la|cr)\b.*/i, "").trim();
  return BRAND_ALIASES[stripped] ?? BRAND_ALIASES[lower] ?? stripped;
}

// ─── Static interaction dataset ───────────────────────────────────────────────
// Covers MENA region common medications + global top drugs.
// severity: major = avoid, moderate = monitor, minor = be aware.
const DRUG_INTERACTIONS: Array<{
  drug1: string;
  drug2: string;
  severity: InteractionSeverity;
  description: string;
  descriptionAr: string;
  recommendation: string;
  recommendationAr: string;
}> = [
  {
    drug1: "aspirin",
    drug2: "ibuprofen",
    severity: "moderate",
    description:
      "Taking aspirin and ibuprofen together may reduce the effectiveness of aspirin and increase risk of gastrointestinal bleeding.",
    descriptionAr:
      "تناول الأسبرين والإيبوبروفين معاً قد يقلل من فعالية الأسبرين ويزيد من خطر النزيف المعدي.",
    recommendation:
      "Take ibuprofen at least 8 hours after or 30 minutes before aspirin. Consult your doctor.",
    recommendationAr:
      "تناول الإيبوبروفين بعد الأسبرين بـ 8 ساعات على الأقل. استشر طبيبك.",
  },
  {
    drug1: "warfarin",
    drug2: "aspirin",
    severity: "major",
    description:
      "Combining warfarin with aspirin significantly increases the risk of serious bleeding.",
    descriptionAr:
      "دمج الوارفارين مع الأسبرين يزيد بشكل كبير من خطر النزيف الخطير.",
    recommendation:
      "Avoid this combination unless specifically prescribed. Monitor for bleeding signs.",
    recommendationAr: "تجنب هذا المزيج ما لم يصفه طبيبك. راقب علامات النزيف.",
  },
  {
    drug1: "metformin",
    drug2: "ibuprofen",
    severity: "moderate",
    description:
      "NSAIDs like ibuprofen can affect kidney function and may reduce metformin clearance.",
    descriptionAr:
      "مضادات الالتهاب كالإيبوبروفين يمكن أن تؤثر على وظائف الكلى وتقلل من إفراز الميتفورمين.",
    recommendation:
      "Use paracetamol instead of ibuprofen when possible. Monitor kidney function.",
    recommendationAr: "استخدم الباراسيتامول بدلاً من الإيبوبروفين إن أمكن.",
  },
  {
    drug1: "atorvastatin",
    drug2: "erythromycin",
    severity: "major",
    description:
      "Erythromycin inhibits atorvastatin metabolism, significantly increasing statin levels and risk of muscle damage (rhabdomyolysis).",
    descriptionAr:
      "الإريثروميسين يثبط استقلاب أتورفاستاتين، مما يزيد مستويات الستاتين وخطر تلف العضلات.",
    recommendation:
      "Avoid this combination. Use a different antibiotic or statin.",
    recommendationAr: "تجنب هذا المزيج. استخدم مضاد حيوي أو ستاتين مختلف.",
  },
  {
    drug1: "lisinopril",
    drug2: "potassium",
    severity: "moderate",
    description:
      "ACE inhibitors like lisinopril can raise potassium levels. Potassium supplements increase the risk of hyperkalemia.",
    descriptionAr:
      "مثبطات ACE مثل ليسينوبريل يمكن أن ترفع مستويات البوتاسيوم. مكملات البوتاسيوم تزيد خطر ارتفاعه.",
    recommendation:
      "Monitor potassium levels regularly. Discuss supplementation with your doctor.",
    recommendationAr:
      "راقب مستويات البوتاسيوم بانتظام. ناقش المكملات مع طبيبك.",
  },
  {
    drug1: "simvastatin",
    drug2: "erythromycin",
    severity: "major",
    description:
      "Erythromycin inhibits simvastatin metabolism, increasing risk of severe muscle damage.",
    descriptionAr:
      "الإريثروميسين يثبط استقلاب سيمفاستاتين مما يزيد خطر تلف العضلات الشديد.",
    recommendation:
      "Avoid concurrent use. Switch to a statin unaffected by CYP3A4 inhibitors.",
    recommendationAr:
      "تجنب الاستخدام المتزامن. انتقل إلى ستاتين غير متأثر بمثبطات CYP3A4.",
  },
  {
    drug1: "metoprolol",
    drug2: "verapamil",
    severity: "major",
    description:
      "Combining metoprolol and verapamil can cause severe bradycardia and heart block.",
    descriptionAr:
      "دمج ميتوبرولول مع فيراباميل يمكن أن يسبب بطء شديد في القلب وحصار قلبي.",
    recommendation: "Avoid this combination. Consult your cardiologist.",
    recommendationAr: "تجنب هذا المزيج. استشر طبيب القلب.",
  },
  {
    drug1: "fluoxetine",
    drug2: "tramadol",
    severity: "major",
    description:
      "Combining SSRIs like fluoxetine with tramadol increases the risk of serotonin syndrome.",
    descriptionAr:
      "دمج مثبطات استرداد السيروتونين مثل فلوكستين مع ترامادول يزيد خطر متلازمة السيروتونين.",
    recommendation: "Avoid this combination. Use an alternative pain reliever.",
    recommendationAr: "تجنب هذا المزيج. استخدم مسكن ألم بديل.",
  },
  {
    drug1: "ciprofloxacin",
    drug2: "antacid",
    severity: "moderate",
    description:
      "Antacids containing aluminium or magnesium can significantly reduce absorption of ciprofloxacin.",
    descriptionAr:
      "مضادات الحموضة التي تحتوي على الألومنيوم أو المغنيسيوم يمكن أن تقلل امتصاص سيبروفلوكساسين.",
    recommendation:
      "Take ciprofloxacin 2 hours before or 6 hours after antacids.",
    recommendationAr:
      "تناول سيبروفلوكساسين قبل 2 ساعة أو بعد 6 ساعات من مضادات الحموضة.",
  },
  {
    drug1: "amlodipine",
    drug2: "simvastatin",
    severity: "moderate",
    description:
      "Amlodipine can increase simvastatin levels, raising the risk of muscle side effects.",
    descriptionAr:
      "أملوديبين يمكن أن يرفع مستويات سيمفاستاتين مما يزيد خطر آثار جانبية عضلية.",
    recommendation:
      "Limit simvastatin to 20mg daily when taken with amlodipine.",
    recommendationAr:
      "حدد سيمفاستاتين بـ 20 ملغ يومياً عند تناوله مع أملوديبين.",
  },
  {
    drug1: "paracetamol",
    drug2: "alcohol",
    severity: "major",
    description:
      "Regular alcohol consumption combined with paracetamol significantly increases risk of liver damage.",
    descriptionAr:
      "استهلاك الكحول مع الباراسيتامول يزيد بشكل كبير من خطر تلف الكبد.",
    recommendation:
      "Limit alcohol use when taking paracetamol. Do not exceed recommended doses.",
    recommendationAr:
      "قلل استهلاك الكحول عند تناول الباراسيتامول. لا تتجاوز الجرعات الموصى بها.",
  },
  {
    drug1: "warfarin",
    drug2: "ibuprofen",
    severity: "major",
    description:
      "NSAIDs like ibuprofen increase bleeding risk when combined with warfarin.",
    descriptionAr:
      "مضادات الالتهاب كالإيبوبروفين تزيد خطر النزيف مع الوارفارين.",
    recommendation:
      "Use paracetamol for pain relief instead. Monitor INR closely.",
    recommendationAr: "استخدم الباراسيتامول لتخفيف الألم. راقب INR عن كثب.",
  },
  {
    drug1: "lisinopril",
    drug2: "ibuprofen",
    severity: "moderate",
    description:
      "NSAIDs can reduce the blood pressure-lowering effect of ACE inhibitors and worsen kidney function.",
    descriptionAr:
      "مضادات الالتهاب يمكن أن تقلل من تأثير مثبطات ACE على ضغط الدم وتضعف وظائف الكلى.",
    recommendation:
      "Use paracetamol instead. Monitor blood pressure and kidney function.",
    recommendationAr:
      "استخدم الباراسيتامول بدلاً منه. راقب ضغط الدم ووظائف الكلى.",
  },
  {
    drug1: "omeprazole",
    drug2: "clopidogrel",
    severity: "moderate",
    description:
      "Omeprazole can reduce the antiplatelet effect of clopidogrel by inhibiting its activation.",
    descriptionAr:
      "أوميبرازول يمكن أن يقلل من التأثير المضاد للصفائح لكلوبيدوجريل.",
    recommendation:
      "Consider switching to pantoprazole, which has less interaction.",
    recommendationAr: "فكر في التحول إلى بانتوبرازول الذي له تفاعل أقل.",
  },
  {
    drug1: "metformin",
    drug2: "alcohol",
    severity: "moderate",
    description:
      "Alcohol increases the risk of lactic acidosis in patients taking metformin.",
    descriptionAr: "الكحول يزيد خطر الحماض اللبني لدى مرضى الميتفورمين.",
    recommendation: "Avoid excessive alcohol consumption while on metformin.",
    recommendationAr: "تجنب الإفراط في تناول الكحول أثناء تناول الميتفورمين.",
  },
  {
    drug1: "sertraline",
    drug2: "tramadol",
    severity: "major",
    description:
      "SSRIs combined with tramadol significantly increase the risk of serotonin syndrome.",
    descriptionAr:
      "مثبطات استرداد السيروتونين مع ترامادول تزيد بشكل كبير من خطر متلازمة السيروتونين.",
    recommendation:
      "Avoid concurrent use. Consult your doctor for alternative pain management.",
    recommendationAr: "تجنب الاستخدام المتزامن. استشر طبيبك لإدارة الألم.",
  },
  {
    drug1: "amoxicillin",
    drug2: "warfarin",
    severity: "moderate",
    description:
      "Amoxicillin can enhance the anticoagulant effect of warfarin, increasing bleeding risk.",
    descriptionAr:
      "الأموكسيسيلين يمكن أن يعزز تأثير الوارفارين المضاد للتخثر، مما يزيد خطر النزيف.",
    recommendation: "Monitor INR closely during amoxicillin treatment.",
    recommendationAr: "راقب INR عن كثب أثناء علاج الأموكسيسيلين.",
  },
  {
    drug1: "digoxin",
    drug2: "amiodarone",
    severity: "major",
    description:
      "Amiodarone inhibits digoxin clearance, causing dangerously elevated digoxin levels.",
    descriptionAr:
      "أميودارون يثبط إفراز ديجوكسين مما يسبب ارتفاعاً خطيراً في مستوياته.",
    recommendation:
      "Reduce digoxin dose by 50% when starting amiodarone. Monitor levels.",
    recommendationAr:
      "قلل جرعة ديجوكسين بنسبة 50% عند بدء أميودارون. راقب المستويات.",
  },
  {
    drug1: "levothyroxine",
    drug2: "calcium",
    severity: "moderate",
    description:
      "Calcium supplements can significantly reduce absorption of levothyroxine if taken together.",
    descriptionAr:
      "مكملات الكالسيوم يمكن أن تقلل امتصاص ليفوثيروكسين بشكل كبير إذا تُناولا معاً.",
    recommendation:
      "Take levothyroxine at least 4 hours apart from calcium supplements.",
    recommendationAr:
      "تناول ليفوثيروكسين بفارق 4 ساعات على الأقل عن مكملات الكالسيوم.",
  },
  {
    drug1: "furosemide",
    drug2: "ibuprofen",
    severity: "moderate",
    description:
      "NSAIDs reduce the diuretic effect of furosemide and may worsen kidney function and fluid retention.",
    descriptionAr:
      "مضادات الالتهاب تقلل التأثير المدر للبول لفيوروسيميد وقد تضعف وظائف الكلى.",
    recommendation:
      "Use paracetamol for pain. Monitor blood pressure and kidney function.",
    recommendationAr: "استخدم الباراسيتامول. راقب ضغط الدم ووظائف الكلى.",
  },
  // ── Additional interactions ──────────────────────────────────────────────
  {
    drug1: "warfarin",
    drug2: "clarithromycin",
    severity: "major",
    description:
      "Clarithromycin inhibits CYP3A4 and significantly raises warfarin levels, greatly increasing bleeding risk.",
    descriptionAr:
      "كلاريثروميسين يثبط CYP3A4 ويرفع مستويات الوارفارين بشكل ملحوظ، مما يزيد خطر النزيف.",
    recommendation: "Monitor INR closely or choose an alternative antibiotic.",
    recommendationAr: "راقب INR عن كثب أو اختر مضاداً حيوياً بديلاً.",
  },
  {
    drug1: "warfarin",
    drug2: "azithromycin",
    severity: "moderate",
    description:
      "Azithromycin can enhance the anticoagulant effect of warfarin, raising bleeding risk.",
    descriptionAr:
      "أزيثروميسين يمكن أن يعزز تأثير الوارفارين المضاد للتخثر ويزيد خطر النزيف.",
    recommendation: "Monitor INR during azithromycin treatment.",
    recommendationAr: "راقب INR أثناء علاج أزيثروميسين.",
  },
  {
    drug1: "warfarin",
    drug2: "metronidazole",
    severity: "major",
    description:
      "Metronidazole markedly potentiates warfarin's anticoagulant effect, significantly increasing bleeding risk.",
    descriptionAr:
      "ميترونيدازول يعزز تأثير الوارفارين بشكل ملحوظ ويزيد خطر النزيف بصورة كبيرة.",
    recommendation:
      "Choose a different antibiotic if possible. If used, monitor INR daily.",
    recommendationAr:
      "اختر مضاداً حيوياً مختلفاً إن أمكن. إذا استُخدم، راقب INR يومياً.",
  },
  {
    drug1: "escitalopram",
    drug2: "tramadol",
    severity: "major",
    description:
      "SSRIs combined with tramadol increase the risk of serotonin syndrome and lower the seizure threshold.",
    descriptionAr:
      "مثبطات استرداد السيروتونين مع ترامادول تزيد خطر متلازمة السيروتونين وتخفض عتبة النوبات.",
    recommendation: "Avoid concurrent use. Use an alternative analgesic.",
    recommendationAr: "تجنب الاستخدام المتزامن. استخدم مسكن ألم بديل.",
  },
  {
    drug1: "paroxetine",
    drug2: "tramadol",
    severity: "major",
    description:
      "Paroxetine combined with tramadol significantly increases the risk of serotonin syndrome.",
    descriptionAr:
      "باروكستين مع ترامادول يزيد بشكل كبير من خطر متلازمة السيروتونين.",
    recommendation: "Avoid concurrent use. Consult your doctor for alternatives.",
    recommendationAr: "تجنب الاستخدام المتزامن. استشر طبيبك للبدائل.",
  },
  {
    drug1: "metformin",
    drug2: "contrast dye",
    severity: "major",
    description:
      "Iodinated contrast media used in imaging can cause acute kidney injury, impairing metformin clearance and raising lactic acidosis risk.",
    descriptionAr:
      "صبغة التباين اليودية في الأشعة يمكن أن تسبب إصابة كلوية حادة تضعف إفراز الميتفورمين وترفع خطر الحماض اللبني.",
    recommendation:
      "Withhold metformin 48 hours before and after contrast procedures. Restart after confirming kidney function.",
    recommendationAr:
      "أوقف الميتفورمين 48 ساعة قبل وبعد إجراء الصبغة. استأنف بعد تأكيد وظائف الكلى.",
  },
  {
    drug1: "lisinopril",
    drug2: "potassium",
    severity: "moderate",
    description:
      "ACE inhibitors raise potassium levels; combining with potassium supplements or spironolactone raises hyperkalemia risk.",
    descriptionAr:
      "مثبطات ACE ترفع البوتاسيوم؛ تناوله مع مكملات البوتاسيوم يزيد خطر فرط البوتاسيوم.",
    recommendation:
      "Monitor serum potassium levels regularly. Avoid high-potassium supplements unless directed.",
    recommendationAr:
      "راقب مستويات البوتاسيوم بانتظام. تجنب مكملات البوتاسيوم العالية ما لم يوجهك طبيبك.",
  },
  {
    drug1: "spironolactone",
    drug2: "potassium",
    severity: "major",
    description:
      "Spironolactone retains potassium; adding potassium supplements significantly increases hyperkalemia risk.",
    descriptionAr:
      "سبيرونولاكتون يحتفظ بالبوتاسيوم؛ إضافة مكملاته يزيد خطر فرط البوتاسيوم بشكل كبير.",
    recommendation:
      "Avoid potassium supplements. Monitor potassium regularly.",
    recommendationAr:
      "تجنب مكملات البوتاسيوم. راقب البوتاسيوم بانتظام.",
  },
  {
    drug1: "sildenafil",
    drug2: "nitrate",
    severity: "major",
    description:
      "Combining PDE5 inhibitors like sildenafil with nitrates causes a severe, potentially life-threatening drop in blood pressure.",
    descriptionAr:
      "دمج مثبطات PDE5 مثل سيلدينافيل مع النترات يسبب انخفاضاً حاداً وخطيراً في ضغط الدم.",
    recommendation: "This combination is absolutely contraindicated. Never use together.",
    recommendationAr: "هذا المزيج موانع استخدام مطلقة. لا تجمع بينهما أبداً.",
  },
  {
    drug1: "sildenafil",
    drug2: "amlodipine",
    severity: "minor",
    description:
      "Both lower blood pressure; combination may cause additive hypotension, especially on standing.",
    descriptionAr:
      "كلاهما يخفض ضغط الدم؛ الجمع بينهما قد يسبب انخفاضاً إضافياً، خاصة عند الوقوف.",
    recommendation:
      "Start sildenafil at a low dose. Rise slowly from sitting or lying positions.",
    recommendationAr:
      "ابدأ بجرعة منخفضة من سيلدينافيل. انهض ببطء من الجلوس أو الاستلقاء.",
  },
  {
    drug1: "levothyroxine",
    drug2: "iron",
    severity: "moderate",
    description:
      "Iron supplements can significantly reduce levothyroxine absorption when taken at the same time.",
    descriptionAr:
      "مكملات الحديد يمكن أن تقلل بشكل كبير من امتصاص ليفوثيروكسين عند تناولهما في نفس الوقت.",
    recommendation:
      "Separate levothyroxine from iron supplements by at least 4 hours.",
    recommendationAr:
      "افصل بين ليفوثيروكسين ومكملات الحديد بفارق 4 ساعات على الأقل.",
  },
  {
    drug1: "atorvastatin",
    drug2: "clarithromycin",
    severity: "major",
    description:
      "Clarithromycin inhibits CYP3A4, dramatically increasing atorvastatin levels and risk of myopathy/rhabdomyolysis.",
    descriptionAr:
      "كلاريثروميسين يثبط CYP3A4 مما يرفع مستويات أتورفاستاتين ويزيد خطر اعتلال العضلات.",
    recommendation:
      "Temporarily stop atorvastatin during clarithromycin course, or choose a macrolide alternative.",
    recommendationAr:
      "أوقف أتورفاستاتين مؤقتاً خلال دورة كلاريثروميسين، أو اختر بديلاً.",
  },
  {
    drug1: "rosuvastatin",
    drug2: "erythromycin",
    severity: "moderate",
    description:
      "Erythromycin can increase rosuvastatin exposure, raising myopathy risk.",
    descriptionAr:
      "إريثروميسين يمكن أن يزيد مستويات روسوفاستاتين مما يرفع خطر اعتلال العضلات.",
    recommendation:
      "Monitor for muscle pain and weakness. Consider dose reduction.",
    recommendationAr:
      "راقب للألم العضلي والضعف. فكر في تخفيض الجرعة.",
  },
  {
    drug1: "clopidogrel",
    drug2: "aspirin",
    severity: "minor",
    description:
      "Dual antiplatelet therapy increases bleeding risk, though this combination is intentional in many cardiac conditions.",
    descriptionAr:
      "العلاج المزدوج بمضادات الصفائح يزيد خطر النزيف، وإن كان هذا المزيج مقصوداً في كثير من حالات القلب.",
    recommendation:
      "Use only when prescribed. Take with a stomach-protecting agent. Avoid cuts and falls.",
    recommendationAr:
      "استخدمه فقط عند الوصف الطبي. تناوله مع حامٍ للمعدة. تجنب الجروح والسقوط.",
  },
  {
    drug1: "metoprolol",
    drug2: "fluoxetine",
    severity: "moderate",
    description:
      "Fluoxetine inhibits CYP2D6, increasing metoprolol levels and the risk of bradycardia.",
    descriptionAr:
      "فلوكستين يثبط CYP2D6 مما يرفع مستويات ميتوبرولول ويزيد خطر بطء القلب.",
    recommendation:
      "Monitor heart rate and blood pressure. Dose adjustment may be required.",
    recommendationAr:
      "راقب معدل ضربات القلب وضغط الدم. قد يلزم تعديل الجرعة.",
  },
  {
    drug1: "metoprolol",
    drug2: "paroxetine",
    severity: "moderate",
    description:
      "Paroxetine is a potent CYP2D6 inhibitor, markedly raising metoprolol plasma levels and bradycardia risk.",
    descriptionAr:
      "باروكستين مثبط قوي لـ CYP2D6 يرفع مستويات ميتوبرولول بشكل ملحوظ ويزيد خطر بطء القلب.",
    recommendation:
      "Monitor closely. Consider switching to a non-CYP2D6-inhibiting antidepressant.",
    recommendationAr:
      "راقب عن كثب. فكر في التحول لمضاد اكتئاب لا يثبط CYP2D6.",
  },
  {
    drug1: "ciprofloxacin",
    drug2: "warfarin",
    severity: "major",
    description:
      "Ciprofloxacin inhibits warfarin metabolism and alters gut flora, significantly increasing INR and bleeding risk.",
    descriptionAr:
      "سيبروفلوكساسين يثبط استقلاب الوارفارين ويغير بكتيريا الأمعاء مما يرفع INR وخطر النزيف.",
    recommendation:
      "Monitor INR closely every 1–2 days during ciprofloxacin course.",
    recommendationAr:
      "راقب INR كل 1-2 يوم أثناء دورة سيبروفلوكساسين.",
  },
  {
    drug1: "quetiapine",
    drug2: "metoprolol",
    severity: "moderate",
    description:
      "Quetiapine can prolong the QT interval; combining with metoprolol may increase the risk of arrhythmia.",
    descriptionAr:
      "كيتيابين يمكن أن يطيل فترة QT؛ دمجه مع ميتوبرولول قد يزيد خطر اضطراب النظم.",
    recommendation:
      "Use with caution. Monitor ECG periodically.",
    recommendationAr:
      "استخدم بحذر. راقب تخطيط القلب بشكل دوري.",
  },
  {
    drug1: "diclofenac",
    drug2: "warfarin",
    severity: "major",
    description:
      "Diclofenac can increase warfarin levels and causes gastric irritation, significantly raising bleeding risk.",
    descriptionAr:
      "ديكلوفيناك يمكن أن يرفع مستويات الوارفارين ويهيج المعدة مما يزيد خطر النزيف بشكل كبير.",
    recommendation:
      "Avoid this combination. Use paracetamol for pain relief.",
    recommendationAr:
      "تجنب هذا المزيج. استخدم الباراسيتامول لتخفيف الألم.",
  },
  {
    drug1: "diclofenac",
    drug2: "lisinopril",
    severity: "moderate",
    description:
      "NSAIDs like diclofenac can blunt the antihypertensive effect of ACE inhibitors and worsen renal function.",
    descriptionAr:
      "مضادات الالتهاب كديكلوفيناك يمكن أن تقلل تأثير مثبطات ACE على ضغط الدم وتضعف الكلى.",
    recommendation:
      "Use paracetamol instead. Monitor blood pressure and renal function.",
    recommendationAr:
      "استخدم الباراسيتامول. راقب ضغط الدم ووظائف الكلى.",
  },
  {
    drug1: "gliclazide",
    drug2: "ciprofloxacin",
    severity: "moderate",
    description:
      "Fluoroquinolones can alter blood glucose levels, causing either hypoglycaemia or hyperglycaemia in patients on sulfonylureas.",
    descriptionAr:
      "الفلوروكينولونات يمكن أن تغير مستوى السكر في الدم، مسببةً انخفاضاً أو ارتفاعاً لدى مرضى سلفونيل يوريا.",
    recommendation:
      "Monitor blood glucose closely during ciprofloxacin treatment.",
    recommendationAr:
      "راقب سكر الدم عن كثب أثناء علاج سيبروفلوكساسين.",
  },
  {
    drug1: "glimepiride",
    drug2: "ciprofloxacin",
    severity: "moderate",
    description:
      "Fluoroquinolones can cause unpredictable blood glucose fluctuations in patients taking sulfonylureas.",
    descriptionAr:
      "الفلوروكينولونات قد تسبب تذبذباً غير متوقع في سكر الدم مع سلفونيل يوريا.",
    recommendation:
      "Monitor blood glucose closely. Adjust sulfonylurea dose if needed.",
    recommendationAr:
      "راقب سكر الدم عن كثب. عدّل جرعة سلفونيل يوريا إذا لزم.",
  },
  {
    drug1: "losartan",
    drug2: "potassium",
    severity: "moderate",
    description:
      "ARBs like losartan raise potassium levels; combining with potassium supplements increases hyperkalemia risk.",
    descriptionAr:
      "حاصرات مستقبلات الأنجيوتنسين مثل لوسارتان ترفع البوتاسيوم؛ مكملاته تزيد خطر فرط البوتاسيوم.",
    recommendation:
      "Monitor serum potassium. Avoid potassium supplements unless medically indicated.",
    recommendationAr:
      "راقب البوتاسيوم. تجنب مكملاته ما لم يكن موجهاً طبياً.",
  },
  {
    drug1: "amiodarone",
    drug2: "warfarin",
    severity: "major",
    description:
      "Amiodarone strongly inhibits warfarin metabolism, causing significant INR elevation and life-threatening bleeding risk.",
    descriptionAr:
      "أميودارون يثبط استقلاب الوارفارين بشدة مما يرفع INR بشكل ملحوظ ويزيد خطر النزيف.",
    recommendation:
      "Reduce warfarin dose by 30–50% and monitor INR every few days until stable.",
    recommendationAr:
      "قلل جرعة الوارفارين بنسبة 30-50% وراقب INR كل بضعة أيام حتى الاستقرار.",
  },
  {
    drug1: "verapamil",
    drug2: "atorvastatin",
    severity: "moderate",
    description:
      "Verapamil inhibits CYP3A4, raising atorvastatin levels and increasing myopathy risk.",
    descriptionAr:
      "فيراباميل يثبط CYP3A4 مما يرفع مستويات أتورفاستاتين ويزيد خطر اعتلال العضلات.",
    recommendation:
      "Limit atorvastatin to 40mg/day. Monitor for muscle pain.",
    recommendationAr:
      "حدد أتورفاستاتين بـ 40 ملغ/يوم. راقب آلام العضلات.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse frequency string to doses per day */
function parseDosesPerDay(frequency: string): number {
  const f = frequency.toLowerCase();
  if (f.includes("once") || f.includes("daily") || f === "1") return 1;
  if (f.includes("twice") || f.includes("2") || f.includes("bid")) return 2;
  if (f.includes("three") || f.includes("3") || f.includes("tid")) return 3;
  if (f.includes("four") || f.includes("4") || f.includes("qid")) return 4;
  if (f.includes("every 8") || f.includes("8 hour")) return 3;
  if (f.includes("every 12") || f.includes("12 hour")) return 2;
  if (f.includes("every 6") || f.includes("6 hour")) return 4;
  if (f.includes("weekly") || f.includes("week")) return 1 / 7;
  return 1;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Check for drug-drug interactions among active medications */
export function checkInteractions(
  medications: Medication[]
): InteractionWarning[] {
  const activeMeds = medications.filter((m) => m.isActive);
  const warnings: InteractionWarning[] = [];

  for (let i = 0; i < activeMeds.length; i++) {
    for (let j = i + 1; j < activeMeds.length; j++) {
      // Normalise both med names through brand alias map
      const med1 = normalizeMedName(activeMeds[i].name);
      const med2 = normalizeMedName(activeMeds[j].name);

      for (const interaction of DRUG_INTERACTIONS) {
        const d1 = interaction.drug1.toLowerCase();
        const d2 = interaction.drug2.toLowerCase();

        // Match either by exact normalised name or by substring (for compound generics)
        const matches =
          ((med1 === d1 || med1.includes(d1)) && (med2 === d2 || med2.includes(d2))) ||
          ((med1 === d2 || med1.includes(d2)) && (med2 === d1 || med2.includes(d1)));

        if (matches) {
          warnings.push({
            drug1: activeMeds[i].name,
            drug2: activeMeds[j].name,
            severity: interaction.severity,
            description: interaction.description,
            descriptionAr: interaction.descriptionAr,
            recommendation: interaction.recommendation,
            recommendationAr: interaction.recommendationAr,
          });
        }
      }
    }
  }

  // Deduplicate (same pair may match multiple interaction entries)
  const seen = new Set<string>();
  const deduped = warnings.filter((w) => {
    const key = [w.drug1, w.drug2, w.severity].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by severity: major first
  const order: Record<InteractionSeverity, number> = {
    major: 0,
    moderate: 1,
    minor: 2,
  };
  return deduped.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Predict medication refill dates based on quantity + frequency */
export function predictRefills(medications: Medication[]): RefillPrediction[] {
  const predictions: RefillPrediction[] = [];
  const activeMeds = medications.filter((m) => m.isActive);

  for (const med of activeMeds) {
    if (!med.quantity || med.quantity <= 0) continue;

    const dosesPerDay = parseDosesPerDay(med.frequency ?? "once");
    if (dosesPerDay <= 0) continue;

    const daysRemaining = Math.floor(med.quantity / dosesPerDay);
    const refillBy = new Date();
    refillBy.setDate(refillBy.getDate() + daysRemaining);

    predictions.push({
      medicationId: med.id,
      name: med.name,
      daysRemaining,
      refillBy,
      isUrgent: daysRemaining <= 7,
    });
  }

  return predictions.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/** Correlate medication compliance days with vital readings */
export async function getEffectivenessInsights(
  userId: string,
  medicationId: string,
  medicationName: string
): Promise<EffectivenessInsight | null> {
  try {
    const genericName = normalizeMedName(medicationName);

    // Map generic medication name to the vital type most relevant for effectiveness monitoring.
    // Statins lower LDL cholesterol — not tracked as a vital in app; no vital mapping.
    let vitalType: string | null = null;
    let metric = "";
    let metricAr = "";

    if (
      genericName.includes("metformin") ||
      genericName.includes("insulin") ||
      genericName.includes("glipizide") ||
      genericName.includes("glyburide") ||
      genericName.includes("gliclazide") ||
      genericName.includes("glimepiride") ||
      genericName.includes("sitagliptin") ||
      genericName.includes("empagliflozin") ||
      genericName.includes("dapagliflozin") ||
      genericName.includes("liraglutide") ||
      genericName.includes("semaglutide")
    ) {
      vitalType = "bloodGlucose";
      metric = "blood glucose";
      metricAr = "سكر الدم";
    } else if (
      genericName.includes("lisinopril") ||
      genericName.includes("amlodipine") ||
      genericName.includes("losartan") ||
      genericName.includes("valsartan") ||
      genericName.includes("telmisartan") ||
      genericName.includes("candesartan") ||
      genericName.includes("atenolol") ||
      genericName.includes("metoprolol") ||
      genericName.includes("ramipril") ||
      genericName.includes("perindopril") ||
      genericName.includes("hydrochlorothiazide") ||
      genericName.includes("furosemide") ||
      genericName.includes("spironolactone") ||
      genericName.includes("propranolol")
    ) {
      vitalType = "bloodPressureSystolic";
      metric = "blood pressure";
      metricAr = "ضغط الدم";
    } else if (
      genericName.includes("digoxin") ||
      genericName.includes("amiodarone") ||
      genericName.includes("verapamil") ||
      genericName.includes("diltiazem")
    ) {
      vitalType = "heartRate";
      metric = "heart rate";
      metricAr = "معدل ضربات القلب";
    }
    // Note: statins (atorvastatin, simvastatin, rosuvastatin, etc.) affect
    // LDL cholesterol which is a lab marker, not a vital sign — no mapping here.

    if (!vitalType) return null;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const vitalsRaw = await api.get<Record<string, unknown>[]>(
      `/api/health/vitals?type=${vitalType}&from=${cutoff.toISOString()}&limit=100`
    );

    if (!vitalsRaw || vitalsRaw.length === 0) return null;

    // Get medication reminders to find taken dates
    const medsRaw = await api.get<Record<string, unknown>[]>(
      "/api/health/medications"
    );
    const med = (medsRaw ?? []).find((m) => m.id === medicationId);
    if (!med) return null;

    const medData = med as unknown as Medication;
    const takenDates = new Set<string>();

    for (const reminder of medData.reminders ?? []) {
      if (reminder.taken && reminder.takenAt) {
        const d = reminder.takenAt ? new Date(reminder.takenAt as unknown as string) : null;
        if (d) takenDates.add(d.toDateString());
      }
    }

    const takenValues: number[] = [];
    const missedValues: number[] = [];

    for (const v of vitalsRaw) {
      const ts = v.recordedAt ? new Date(v.recordedAt as string) : new Date();
      const val = Number(v.value);
      if (Number.isNaN(val)) continue;

      if (takenDates.has(ts.toDateString())) {
        takenValues.push(val);
      } else {
        missedValues.push(val);
      }
    }

    if (takenValues.length < 3 || missedValues.length < 3) return null;

    const takenAvg =
      takenValues.reduce((a, b) => a + b, 0) / takenValues.length;
    const missedAvg =
      missedValues.reduce((a, b) => a + b, 0) / missedValues.length;
    const diff = Math.abs(takenAvg - missedAvg);
    const pctDiff = (diff / (Math.abs(missedAvg) || 1)) * 100;

    if (pctDiff < 3) return null; // Not significant

    const better =
      vitalType === "bloodGlucose" || vitalType === "bloodPressureSystolic"
        ? takenAvg < missedAvg
        : takenAvg > missedAvg;

    const insight = better
      ? `Your ${metric} is ${pctDiff.toFixed(0)}% better on days you take ${medicationName}. Consistency matters!`
      : `Your ${metric} is higher on days you take ${medicationName}. Discuss with your doctor.`;
    const insightAr = better
      ? `${metricAr} أفضل بنسبة ${pctDiff.toFixed(0)}% في الأيام التي تتناول فيها ${medicationName}. الانتظام مهم!`
      : `${metricAr} أعلى في أيام تناول ${medicationName}. ناقش ذلك مع طبيبك.`;

    return {
      medicationId,
      medicationName,
      metric,
      metricAr,
      takenAvg: Math.round(takenAvg * 10) / 10,
      missedAvg: Math.round(missedAvg * 10) / 10,
      insight,
      insightAr,
    };
  } catch {
    return null;
  }
}

export const medicationIntelligenceService = {
  checkInteractions,
  predictRefills,
  getEffectivenessInsights,
};
