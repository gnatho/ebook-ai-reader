"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  BookMeta,
  Highlight,
  HighlightColor,
  ReadingProgress,
  SavedQuote,
} from "@/lib/types";
import { uid } from "@/lib/utils";

interface ReaderState {
  books: BookMeta[];
  currentBookId: string | null;
  sampleBookId: string | null;
  progress: Record<string, ReadingProgress>;
  highlights: Highlight[];
  quotes: SavedQuote[];

  bytes: Map<string, ArrayBuffer>;

  addBook: (meta: BookMeta, bytes: ArrayBuffer) => void;
  hasBytes: (id: string) => boolean;
  getBytes: (id: string) => ArrayBuffer | undefined;
  hydrateBytes: (id: string, bytes: ArrayBuffer) => void;
  removeBook: (id: string) => void;
  setCurrentBook: (id: string | null) => void;
  setSampleBookId: (id: string | null) => void;

  saveProgress: (p: ReadingProgress) => void;
  getProgress: (bookId: string) => ReadingProgress | undefined;

  addHighlight: (h: Omit<Highlight, "id" | "createdAt">) => Highlight;
  updateHighlight: (id: string, patch: Partial<Highlight>) => void;
  removeHighlight: (id: string) => void;
  highlightsFor: (bookId: string) => Highlight[];

  addQuote: (q: Omit<SavedQuote, "id" | "createdAt">) => SavedQuote;
  removeQuote: (id: string) => void;
  quotesFor: (bookId: string) => SavedQuote[];
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set, get) => ({
      books: [],
      currentBookId: null,
      sampleBookId: null,
      progress: {},
      highlights: [],
      quotes: [],
      bytes: new Map(),

      addBook: (meta, bytes) =>
        set((s) => {
          const exists = s.books.some((b) => b.id === meta.id);
          const next = new Map(s.bytes);
          next.set(meta.id, bytes);
          return {
            books: exists ? s.books : [meta, ...s.books],
            bytes: next,
            currentBookId: meta.id,
          };
        }),
      hasBytes: (id) => get().bytes.has(id),
      getBytes: (id) => get().bytes.get(id),
      hydrateBytes: (id, bytes) =>
        set((s) => {
          const next = new Map(s.bytes);
          next.set(id, bytes);
          return { bytes: next };
        }),
      removeBook: (id) =>
        set((s) => ({
          books: s.books.filter((b) => b.id !== id),
          highlights: s.highlights.filter((h) => h.bookId !== id),
          quotes: s.quotes.filter((q) => q.bookId !== id),
          progress: Object.fromEntries(
            Object.entries(s.progress).filter(([k]) => k !== id)
          ),
          currentBookId: s.currentBookId === id ? null : s.currentBookId,
          bytes: (() => {
            const next = new Map(s.bytes);
            next.delete(id);
            return next;
          })(),
        })),
      setCurrentBook: (id) => set({ currentBookId: id }),
      setSampleBookId: (id) => set({ sampleBookId: id }),

      saveProgress: (p) =>
        set((s) => ({ progress: { ...s.progress, [p.bookId]: p } })),
      getProgress: (bookId) => get().progress[bookId],

      addHighlight: (h) => {
        const highlight: Highlight = {
          ...h,
          id: uid(),
          createdAt: Date.now(),
        };
        set((s) => ({ highlights: [highlight, ...s.highlights] }));
        return highlight;
      },
      updateHighlight: (id, patch) =>
        set((s) => ({
          highlights: s.highlights.map((h) =>
            h.id === id ? { ...h, ...patch } : h
          ),
        })),
      removeHighlight: (id) =>
        set((s) => ({
          highlights: s.highlights.filter((h) => h.id !== id),
        })),
      highlightsFor: (bookId) =>
        get().highlights.filter((h) => h.bookId === bookId),

      addQuote: (q) => {
        const quote: SavedQuote = {
          ...q,
          id: uid(),
          createdAt: Date.now(),
        };
        set((s) => ({ quotes: [quote, ...s.quotes] }));
        return quote;
      },
      removeQuote: (id) =>
        set((s) => ({ quotes: s.quotes.filter((q) => q.id !== id) })),
      quotesFor: (bookId) => get().quotes.filter((q) => q.bookId === bookId),
    }),
    {
      name: "ebook-reader:reader",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({
        books: s.books,
        currentBookId: s.currentBookId,
        sampleBookId: s.sampleBookId,
        progress: s.progress,
        highlights: s.highlights,
        quotes: s.quotes,
      }),
    }
  )
);

export type { HighlightColor };
