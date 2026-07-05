import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BookMeta, FontOption, HighlightColor } from "./types";

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

export const HIGHLIGHT_COLORS: { key: HighlightColor; hex: string; ring: string }[] = [
  { key: "yellow", hex: "#fde047", ring: "ring-yellow-400" },
  { key: "green", hex: "#86efac", ring: "ring-green-400" },
  { key: "blue", hex: "#93c5fd", ring: "ring-blue-400" },
  { key: "pink", hex: "#f9a8d4", ring: "ring-pink-400" },
  { key: "purple", hex: "#d8b4fe", ring: "ring-purple-400" },
];

export function colorHex(key: HighlightColor): string {
  return HIGHLIGHT_COLORS.find((c) => c.key === key)?.hex ?? "#fde047";
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function fileToBookMeta(file: File): Promise<BookMeta> {
  const format = file.name.toLowerCase().endsWith(".txt") ? "txt" : "epub";
  return {
    id: await hashFile(file),
    title: file.name.replace(/\.(epub|txt)$/i, ""),
    format,
    addedAt: Date.now(),
    size: file.size,
  };
}

export async function bufferToBookMeta(
  name: string,
  bytes: ArrayBuffer
): Promise<BookMeta> {
  const format = name.toLowerCase().endsWith(".txt") ? "txt" : "epub";
  return {
    id: hashBytes(bytes),
    title: name.replace(/\.(epub|txt)$/i, ""),
    format,
    addedAt: Date.now(),
    size: bytes.byteLength,
  };
}

export async function hashFile(file: File): Promise<string> {
  return hashBytes(await file.arrayBuffer());
}

export function hashBytes(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let h1 = 0xdeadbeef ^ view.length;
  let h2 = 0x41c6ce57 ^ view.length;
  for (let i = 0; i < view.length; i++) {
    const c = view[i];
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  return `bk-${hash}`;
}

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}
