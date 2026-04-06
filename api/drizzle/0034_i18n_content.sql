CREATE TABLE i18n_content (
  id           TEXT PRIMARY KEY,
  content_key  TEXT NOT NULL,
  locale       TEXT NOT NULL,
  value        TEXT NOT NULL,
  namespace    TEXT NOT NULL DEFAULT 'common',
  placeholders JSONB,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX i18n_content_key_locale_idx ON i18n_content(content_key, locale);
CREATE INDEX i18n_content_namespace_locale_idx ON i18n_content(namespace, locale);

-- Seed critical alert content in English and Arabic
INSERT INTO i18n_content (id, content_key, locale, namespace, value) VALUES
  (gen_random_uuid()::text, 'alert.heart_rate.above_threshold', 'en', 'alerts', 'Your heart rate ({{value}} {{unit}}) is above the safe threshold of {{threshold}}'),
  (gen_random_uuid()::text, 'alert.heart_rate.above_threshold', 'ar', 'alerts', 'معدل ضربات قلبك ({{value}} {{unit}}) يتجاوز الحد الآمن البالغ {{threshold}}'),
  (gen_random_uuid()::text, 'alert.heart_rate.below_threshold', 'en', 'alerts', 'Your heart rate ({{value}} {{unit}}) is below the safe threshold of {{threshold}}'),
  (gen_random_uuid()::text, 'alert.heart_rate.below_threshold', 'ar', 'alerts', 'معدل ضربات قلبك ({{value}} {{unit}}) أقل من الحد الآمن البالغ {{threshold}}'),
  (gen_random_uuid()::text, 'alert.fall_detected', 'en', 'alerts', 'A fall has been detected. Please check on your family member.'),
  (gen_random_uuid()::text, 'alert.fall_detected', 'ar', 'alerts', 'تم اكتشاف سقوط. يرجى التحقق من حال أحد أفراد عائلتك.'),
  (gen_random_uuid()::text, 'alert.medication_missed', 'en', 'medications', 'Medication reminder: {{medicationName}} is due now'),
  (gen_random_uuid()::text, 'alert.medication_missed', 'ar', 'medications', 'تذكير بالدواء: {{medicationName}} موعد تناوله الآن'),
  (gen_random_uuid()::text, 'alert.spo2.below_threshold', 'en', 'alerts', 'Blood oxygen ({{value}}%) is below normal. Seek medical attention if symptoms worsen.'),
  (gen_random_uuid()::text, 'alert.spo2.below_threshold', 'ar', 'alerts', 'نسبة الأكسجين في الدم ({{value}}%) أقل من الطبيعي. اطلب الرعاية الطبية إذا تفاقمت الأعراض.')
ON CONFLICT DO NOTHING;
