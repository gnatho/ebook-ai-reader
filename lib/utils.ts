import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BookMeta, FontOption } from "./types";
import { hashBytes, uid } from "./hash";

// Re-export shared pure helpers so existing client imports keep working.
export { hashBytes, uid };

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FONT_OPTIONS: FontOption[] = [
  { key: "sans", label: "Sans", stack: "var(--font-geist-sans), system-ui, sans-serif" },
  { key: "serif", label: "Serif", stack: 'Georgia, "Times New Roman", serif' },
  { key: "mono", label: "Mono", stack: 'var(--font-geist-mono), ui-monospace, monospace' },
];

export const FONT_MIN = 12;
export const FONT_MAX = 32;
export const FONT_STEP = 1;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Book metadata is now produced server-side from the shared EPUB library
// (see lib/server/library.ts). The client receives ready-made `BookMeta`
// objects via the /api/library endpoint, so no client-side meta builders
// are needed here.
export type { BookMeta };
