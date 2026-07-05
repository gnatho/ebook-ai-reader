"use client";

import { Quote, Trash2 } from "lucide-react";
import { useReaderStore } from "@/lib/store/useReaderStore";

interface QuotesPanelProps {
  onOpen: (bookId: string, cfi?: string) => void;
}

export function QuotesPanel({ onOpen }: QuotesPanelProps) {
  const quotes = useReaderStore((s) => s.quotes);
  const books = useReaderStore((s) => s.books);
  const removeQuote = useReaderStore((s) => s.removeQuote);

  if (quotes.length === 0) {
    return (
      <EmptyState
        icon={<Quote className="h-8 w-8" />}
        title="No saved quotes"
        subtitle="Save memorable passages from the selection menu while reading."
      />
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {quotes.map((q) => {
        const book = books.find((b) => b.id === q.bookId);
        return (
          <div
            key={q.id}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <Quote className="mb-2 h-4 w-4 text-accent" />
            <button
              type="button"
              onClick={() => onOpen(q.bookId, q.cfiRange)}
              className="block w-full text-left"
            >
              <p className="text-sm italic leading-relaxed text-foreground">
                “{q.text}”
              </p>
            </button>
            <div className="mt-2 flex items-center justify-between">
              <span className="truncate text-[11px] text-muted">
                {book?.title ?? "Unknown book"}
              </span>
              <button
                type="button"
                aria-label="Delete quote"
                onClick={() => removeQuote(q.id)}
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
