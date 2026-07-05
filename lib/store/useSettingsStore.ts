"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  FontFamilyKey,
  Settings,
  TargetLanguage,
  Theme,
} from "@/lib/types";
import {
  FONT_MAX,
  FONT_MIN,
  FONT_OPTIONS,
  FONT_STEP,
} from "@/lib/utils";

interface SettingsState extends Settings {
  setFontSize: (size: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  setFontFamily: (family: FontFamilyKey) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setTargetLanguage: (lang: TargetLanguage) => void;
  setLineHeight: (value: number) => void;
  setLetterSpacing: (value: number) => void;
  reset: () => void;
}

export const DEFAULT_SETTINGS: Settings = {
  fontSize: 18,
  fontFamily: "serif",
  theme: "dark",
  targetLanguage: "en-en",
  lineHeight: 1.7,
  letterSpacing: 0,
};

function clampFontSize(size: number) {
  return Math.min(FONT_MAX, Math.max(FONT_MIN, size));
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      setFontSize: (size) => set({ fontSize: clampFontSize(size) }),
      increaseFontSize: () =>
        set({ fontSize: clampFontSize(get().fontSize + FONT_STEP) }),
      decreaseFontSize: () =>
        set({ fontSize: clampFontSize(get().fontSize - FONT_STEP) }),
      setFontFamily: (family) => set({ fontFamily: family }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set({ theme: get().theme === "dark" ? "light" : "dark" }),
      setTargetLanguage: (targetLanguage) => set({ targetLanguage }),
      setLineHeight: (lineHeight) =>
        set({ lineHeight: Math.min(2.2, Math.max(1.2, lineHeight)) }),
      setLetterSpacing: (letterSpacing) =>
        set({ letterSpacing: Math.min(0.2, Math.max(-0.05, letterSpacing)) }),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: "ebook-reader:settings",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        theme: state.theme,
        targetLanguage: state.targetLanguage,
        lineHeight: state.lineHeight,
        letterSpacing: state.letterSpacing,
      }),
    }
  )
);

export function fontFamilyStack(key: FontFamilyKey): string {
  return FONT_OPTIONS.find((f) => f.key === key)?.stack ?? FONT_OPTIONS[0].stack;
}
