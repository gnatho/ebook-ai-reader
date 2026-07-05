"use client";

import {
  Highlighter,
  Library,
  Quote,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Tab = "library" | "highlights" | "quotes" | "settings";

interface NavItem {
  key: Tab;
  label: string;
  Icon: typeof Library;
}

const ITEMS: NavItem[] = [
  { key: "library", label: "Library", Icon: Library },
  { key: "highlights", label: "Marks", Icon: Highlighter },
  { key: "quotes", label: "Quotes", Icon: Quote },
  { key: "settings", label: "Settings", Icon: Settings },
];

interface BottomNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  className?: string;
}

export function BottomNav({ active, onChange, className }: BottomNavProps) {
  return (
    <nav
      className={cn(
        "sticky bottom-0 z-30 grid grid-cols-4 border-t border-border bg-background/85 backdrop-blur-md",
        className
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {ITEMS.map(({ key, label, Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="flex flex-col items-center justify-center gap-1 py-2.5"
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              className={cn(
                "h-[22px] w-[22px] transition-colors",
                isActive ? "text-accent" : "text-muted"
              )}
              strokeWidth={isActive ? 2.4 : 2}
            />
            <span
              className={cn(
                "text-[10px] font-medium transition-colors",
                isActive ? "text-accent" : "text-muted"
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
