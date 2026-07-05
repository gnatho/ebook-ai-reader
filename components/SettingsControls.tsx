"use client";

import {
  Languages,
  Minus,
  Moon,
  Plus,
  Sun,
  Type as TypeIcon,
} from "lucide-react";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import {
  FONT_MAX,
  FONT_MIN,
  FONT_OPTIONS,
  cn,
} from "@/lib/utils";
import type { FontFamilyKey } from "@/lib/types";

export function SettingsControls() {
  const s = useSettingsStore();

  return (
    <div className="space-y-6">
      <Section icon={<TypeIcon className="h-4 w-4" />} title="Text">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-muted">Font size</span>
          <div className="flex items-center gap-2">
            <StepBtn onClick={() => s.decreaseFontSize()} disabled={s.fontSize <= FONT_MIN}>
              <Minus className="h-4 w-4" />
            </StepBtn>
            <span className="w-10 text-center text-sm font-medium tabular-nums">
              {s.fontSize}
            </span>
            <StepBtn onClick={() => s.increaseFontSize()} disabled={s.fontSize >= FONT_MAX}>
              <Plus className="h-4 w-4" />
            </StepBtn>
          </div>
        </div>
        <div className="mb-4">
          <span className="mb-2 block text-sm text-muted">Line spacing</span>
          <input
            type="range"
            min={1.2}
            max={2.2}
            step={0.1}
            value={s.lineHeight}
            onChange={(e) => s.setLineHeight(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </div>
        <div>
          <span className="mb-2 block text-sm text-muted">Letter spacing</span>
          <input
            type="range"
            min={-0.05}
            max={0.2}
            step={0.01}
            value={s.letterSpacing}
            onChange={(e) => s.setLetterSpacing(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </div>
      </Section>

      <Section icon={<TypeIcon className="h-4 w-4" />} title="Font family">
        <div className="grid grid-cols-3 gap-2">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => s.setFontFamily(f.key as FontFamilyKey)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm transition-colors",
                s.fontFamily === f.key
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-foreground/80 hover:bg-surface-2"
              )}
              style={{ fontFamily: f.stack }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Section>

      <Section icon={<Languages className="h-4 w-4" />} title="Target language">
        <div className="grid grid-cols-2 gap-2">
          <LangBtn
            active={s.targetLanguage === "en-en"}
            onClick={() => s.setTargetLanguage("en-en")}
            title="English → English"
            subtitle="Definition"
          />
          <LangBtn
            active={s.targetLanguage === "en-zh"}
            onClick={() => s.setTargetLanguage("en-zh")}
            title="English → 中文"
            subtitle="Translation"
          />
        </div>
      </Section>

      <Section icon={<Sun className="h-4 w-4" />} title="Theme">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => s.setTheme("light")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm",
              s.theme === "light"
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-foreground/80 hover:bg-surface-2"
            )}
          >
            <Sun className="h-4 w-4" /> Light
          </button>
          <button
            type="button"
            onClick={() => s.setTheme("dark")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm",
              s.theme === "dark"
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-foreground/80 hover:bg-surface-2"
            )}
          >
            <Moon className="h-4 w-4" /> Dark
          </button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function StepBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="grid h-9 w-9 place-items-center rounded-lg border border-border text-foreground/80 transition-colors hover:bg-surface-2 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function LangBtn({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-left transition-colors",
        active ? "border-accent bg-accent/10" : "border-border hover:bg-surface-2"
      )}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted">{subtitle}</div>
    </button>
  );
}
