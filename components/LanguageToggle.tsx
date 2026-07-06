"use client";

import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { cn } from "@/lib/utils";
import type { TargetLanguage } from "@/lib/types";

const FLAG: Record<TargetLanguage, string> = {
  "en-en": "🇺🇸",
  "en-zh": "🇨🇳",
};

export function LanguageToggle({ className }: { className?: string }) {
  const targetLanguage = useSettingsStore((s) => s.targetLanguage);
  const setTargetLanguage = useSettingsStore((s) => s.setTargetLanguage);

  function toggle() {
    setTargetLanguage(targetLanguage === "en-en" ? "en-zh" : "en-en");
  }

  return (
    <button
      type="button"
      aria-label={
        targetLanguage === "en-en"
          ? "Target language: English. Switch to Chinese."
          : "Target language: Chinese. Switch to English."
      }
      onClick={toggle}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full text-base leading-none transition-colors hover:bg-surface-2 active:scale-95",
        className
      )}
    >
      <span className="select-none">{FLAG[targetLanguage]}</span>
    </button>
  );
}
