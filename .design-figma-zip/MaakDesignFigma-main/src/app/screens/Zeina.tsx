import { AlertTriangle, Mic, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { BottomNav } from "../components/ui/BottomNav";
import { WavyBackground } from "../components/ui/WavyBackground";
import { useLanguage } from "../context/LanguageContext";

export function Zeina() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [message, setMessage] = useState("");

  const messages = [
    {
      id: "msg-1",
      role: "assistant",
      content: t("zeina.greeting"),
      time: "10:30 AM",
    },
    {
      id: "msg-2",
      role: "user",
      content: "How is my mom doing today?",
      time: "10:31 AM",
    },
    {
      id: "msg-3",
      role: "assistant",
      content:
        "Your mom Sarah is doing well today! Her heart rate has been stable at 72 bpm, and she took her morning medication on time. I noticed her sleep quality improved by 15% this week. Would you like me to send you a detailed health report?",
      time: "10:31 AM",
    },
  ];

  const quickActions = [
    "Medication reminders",
    "Weekly health summary",
    "Schedule appointment",
    "Emergency contacts",
  ];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-[#F0FAFB] via-[#F9FDFE] to-[#FFF9EB] pb-24">
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-gradient-to-br from-[#003543]/5 to-transparent blur-3xl" />
      <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-gradient-to-tr from-[#EB9C0C]/5 to-transparent blur-3xl" />

      {/* Header with Wavy Background */}
      <WavyBackground variant="teal">
        <div className="px-[24px] pt-[18px] pb-[4px]">
          <div className="mt-20">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EB9C0C]">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-2xl text-[#003543]">Zeina AI</h1>
                <p className="font-bold text-[#003543]/70 text-sm">
                  Your health assistant
                </p>
              </div>
            </div>
          </div>
        </div>
      </WavyBackground>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.map((message) => (
          <div
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            key={message.id}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "rounded-br-sm bg-[#003543] text-white"
                  : "rounded-bl-sm border border-[#E5E7EB] bg-white text-[#1A1D1F]"
              }`}
            >
              {message.role === "assistant" && (
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#EB9C0C]" />
                  <span className="font-medium text-[#6C7280] text-xs">
                    Zeina
                  </span>
                </div>
              )}
              <p className="text-sm leading-relaxed">{message.content}</p>
              <p
                className={`mt-2 text-xs ${
                  message.role === "user" ? "text-white/60" : "text-[#9CA3AF]"
                }`}
              >
                {message.time}
              </p>
            </div>
          </div>
        ))}

        {/* Quick actions */}
        <div className="pt-4">
          <p className="mb-3 font-medium text-[#9CA3AF] text-xs">
            Quick actions
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <button
                className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-left transition-all hover:border-[#EB9C0C]/50 hover:bg-[#EB9C0C]/5"
                key={action}
              >
                <div className="mb-1 text-[#436b85] text-xl">{action}</div>
                <p className="font-medium text-[#1A1D1F] text-sm">{action}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="relative z-10 border-[#F59E0B]/20 border-t bg-[#FEF3C7] px-6 py-3">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#F59E0B]" />
          <p className="text-[#92400E] text-xs leading-relaxed">
            {t("zeina.disclaimer")}
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="relative z-10 border-[#E5E7EB] border-t bg-white px-6 py-4">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-transparent bg-[#F3F4F6] px-4 py-3 outline-none transition-all focus:border-[#003543] focus:bg-white"
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("zeina.ask.placeholder")}
            type="text"
            value={message}
          />
          <button className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F3F4F6] transition-colors hover:bg-[#E5E7EB]">
            <Mic className="h-5 w-5 text-[#4E5661]" />
          </button>
          <button className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EB9C0C] shadow-sm transition-colors hover:bg-[#EB9C0C]/90">
            <Send className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
