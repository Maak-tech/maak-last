import {
  Activity,
  Bell,
  ChevronRight,
  Globe,
  Heart,
  MessageCircle,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/Button";
import { WatermarkPattern } from "../components/ui/WatermarkPattern";
import { useLanguage } from "../context/LanguageContext";

export function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();

  const steps = [
    {
      icon: Heart,
      title: t("onboarding.title.1"),
      subtitle: t("onboarding.subtitle.1"),
      color: "#EB9C0C",
    },
    {
      icon: Activity,
      title: t("onboarding.title.2"),
      subtitle: t("onboarding.subtitle.2"),
      color: "#003543",
    },
    {
      icon: Bell,
      title: t("onboarding.title.3"),
      subtitle: t("onboarding.subtitle.3"),
      color: "#10B981",
    },
    {
      icon: MessageCircle,
      title: t("onboarding.title.4"),
      subtitle: t("onboarding.subtitle.4"),
      color: "#EB9C0C",
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;
  const isLastStep = step === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      navigate("/home");
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    navigate("/home");
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#F9FDFE]">
      <WatermarkPattern />

      {/* Language toggle */}
      <div className="absolute top-6 right-6 z-20">
        <button
          className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white/80 px-4 py-2 font-medium text-[#4E5661] text-sm backdrop-blur-sm transition-colors hover:bg-white"
          onClick={() => setLanguage(language === "en" ? "ar" : "en")}
        >
          <Globe className="h-4 w-4" />
          {language === "en" ? "العربية" : "English"}
        </button>
      </div>

      {/* Progress indicators */}
      <div className="relative z-10 flex justify-center gap-2 px-6 pt-8">
        {steps.map((_, index) => (
          <div
            className={`h-1 rounded-full transition-all ${
              index === step
                ? "w-8 bg-[#003543]"
                : index < step
                  ? "w-1 bg-[#003543]"
                  : "w-1 bg-[#D1D5DB]"
            }`}
            key={index}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Icon */}
        <div
          className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl shadow-lg"
          style={{ backgroundColor: `${currentStep.color}15` }}
        >
          <Icon className="h-12 w-12" style={{ color: currentStep.color }} />
        </div>

        {/* Logo for first step */}
        {step === 0 && (
          <div className="mb-6 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full bg-[#003543]" />
              <div className="h-3 w-3 rounded-full bg-[#EB9C0C]" />
            </div>
            <h1 className="font-bold text-3xl text-[#003543]">
              {t("app.name")}
            </h1>
          </div>
        )}

        {/* Title and subtitle */}
        <h2 className="mb-4 max-w-sm text-center font-semibold text-3xl text-[#1A1D1F]">
          {currentStep.title}
        </h2>
        <p className="mb-8 max-w-md text-center text-[#6C7280] text-lg">
          {currentStep.subtitle}
        </p>

        {/* Illustration placeholder */}
        <div className="mb-12 flex h-64 w-64 items-center justify-center rounded-3xl border border-[#E5E7EB] bg-gradient-to-br from-[#F9FDFE] to-[#E5E7EB]/30">
          <Icon className="h-32 w-32 text-[#D1D5DB]" />
        </div>
      </div>

      {/* Actions */}
      <div className="relative z-10 space-y-3 px-6 pb-8">
        <Button fullWidth onClick={handleNext} size="lg" variant="primary">
          {isLastStep ? t("onboarding.get.started") : t("onboarding.next")}
          <ChevronRight className="h-5 w-5" />
        </Button>

        {!isLastStep && (
          <button
            className="w-full py-3 font-medium text-[#6C7280] transition-colors hover:text-[#4E5661]"
            onClick={handleSkip}
          >
            {t("onboarding.skip")}
          </button>
        )}
      </div>
    </div>
  );
}
