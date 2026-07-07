"use client";

import { Languages, Trash2 } from "lucide-react";
import { useReaderStore } from "@/lib/store/useReaderStore";

interface TranslationsPanelProps {
  onOpen: (bookId: string, cfi?: string) => void;
}

export function TranslationsPanel({ onOpen }: TranslationsPanelProps) {
  const translations = useReaderStore((s) => s.translations);
  const books = useReaderStore((s) => s.books);
  const removeTranslation = useReaderStore((s) => s.removeTranslation);

  if (translations.length === 0) {
    return (
      <EmptyState
        icon={<Languages className="h-8 w-8" />}
        title="No translations yet"
        subtitle="Translate a word or passage while reading to save it here."
      />
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {translations.map((t) => {
        const book = books.find((b) => b.id === t.bookId);
        return (
          <div
            key={t.id}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <Languages className="mb-2 h-4 w-4 text-accent" />
            <button
              type="button"
              onClick={() => onOpen(t.bookId, t.cfiRange)}
              className="block w-full text-left"
            >
              <p className="text-sm font-medium leading-relaxed text-foreground">
                {t.source}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {t.result}
              </p>
              {t.example && (
                <p className="mt-1 border-l-2 border-accent/50 pl-2 text-[13px] italic leading-relaxed text-muted">
                  {t.example}
                </p>
              )}
            </button>
            <div className="mt-2 flex items-center justify-between">
              <span className="truncate text-[11px] text-muted">
                {book?.title ?? "Unknown book"}
              </span>
              <button
                type="button"
                aria-label="Delete translation"
                onClick={() => removeTranslation(t.id)}
                className="grid h-7 w-7 place-items-center rounded-full text-muted hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-surface-2 text-muted">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-[16rem] text-sm text-muted">{subtitle}</p>
    </div>
  );
}
