"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  BookMeta,
  ReadingProgress,
  SavedQuote,
  SavedTranslation,
} from "@/lib/types";
import { uid } from "@/lib/utils";

/**
 * Reader state.
 *
 * The shared `books` list is fetched from the server (GET /api/library) and
 * held here for convenient app-wide access; it is NOT persisted, since it is
 * the server's source of truth.
 *
 * Per-user reading state — current book, reading progress, translations and
 * quotes — IS persisted to localStorage so each user keeps their own
 * position and annotations across sessions, while sharing the same library.
 */
interface ReaderState {
  books: BookMeta[];
  currentBookId: string | null;
  progress: Record<string, ReadingProgress>;
  translations: SavedTranslation[];
  quotes: SavedQuote[];

  setBooks: (books: BookMeta[]) => void;
  removeBook: (id: string) => void;
  setCurrentBook: (id: string | null) => void;

  saveProgress: (p: ReadingProgress) => void;
  getProgress: (bookId: string) => ReadingProgress | undefined;

  addTranslation: (t: Omit<SavedTranslation, "id" | "createdAt">) => SavedTranslation;
  removeTranslation: (id: string) => void;
  translationsFor: (bookId: string) => SavedTranslation[];

  addQuote: (q: Omit<SavedQuote, "id" | "createdAt">) => SavedQuote;
  removeQuote: (id: string) => void;
  quotesFor: (bookId: string) => SavedQuote[];
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set, get) => ({
      books: [],
      currentBookId: null,
      progress: {},
      translations: [],
      quotes: [],

      setBooks: (books) => set({ books }),
      // Optimistic local removal used after a successful server delete.
      removeBook: (id) =>
        set((s) => ({
          books: s.books.filter((b) => b.id !== id),
          currentBookId: s.currentBookId === id ? null : s.currentBookId,
        })),
      setCurrentBook: (id) => set({ currentBookId: id }),

      saveProgress: (p) =>
        set((s) => ({ progress: { ...s.progress, [p.bookId]: p } })),
      getProgress: (bookId) => get().progress[bookId],

      addTranslation: (t) => {
        const translation: SavedTranslation = {
          ...t,
          id: uid(),
          createdAt: Date.now(),
        };
        set((s) => ({ translations: [translation, ...s.translations] }));
        return translation;
      },
      removeTranslation: (id) =>
        set((s) => ({
          translations: s.translations.filter((t) => t.id !== id),
        })),
      translationsFor: (bookId) =>
        get().translations.filter((t) => t.bookId === bookId),

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
      version: 3,
      // Only persist per-user reading state — the shared book list is fetched.
      partialize: (s) => ({
        currentBookId: s.currentBookId,
        progress: s.progress,
        translations: s.translations,
        quotes: s.quotes,
      }),
      // Rebuild persisted state for any prior version: drop the legacy
      // `highlights` collection (replaced by `translations`) and drop the
      // server-authoritative `books`/`sampleBookId` fields from v1.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<ReaderState>;
        return {
          currentBookId: p.currentBookId ?? null,
          progress: p.progress ?? {},
          translations: p.translations ?? [],
          quotes: p.quotes ?? [],
        };
      },
    }
  )
);
