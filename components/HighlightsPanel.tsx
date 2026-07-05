"use client";

import { Highlighter, Trash2 } from "lucide-react";
import { useReaderStore } from "@/lib/store/useReaderStore";
import { colorHex } from "@/lib/utils";

interface HighlightsPanelProps {
  onOpen: (bookId: string, cfi?: string) => void;
}

export function HighlightsPanel({ onOpen }: HighlightsPanelProps) {
  const highlights = useReaderStore((s) => s.highlights);
  const books = useReaderStore((s) => s.books);
  const removeHighlight = useReaderStore((s) => s.removeHighlight);

  if (highlights.length === 0) {
    return (
      <EmptyState
        icon={<Highlighter className="h-8 w-8" />}
        title="No highlights yet"
        subtitle="Select text while reading to highlight passages in color."
      />
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {highlights.map((h) => {
        const book = books.find((b) => b.id === h.bookId);
        return (
          <div
            key={h.id}
            className="rounded-2xl border border-border bg-surface p-3"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: colorHex(h.color) }}
              />
              <span className="truncate text-[11px] text-muted">
                {book?.title ?? "Unknown book"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpen(h.bookId, h.cfiRange)}
              className="block w-full text-left"
            >
              <p className="line-clamp-3 text-sm leading-relaxed">{h.text}</p>
            </button>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-muted">
                {new Date(h.createdAt).toLocaleDateString()}
              </span>
              <button
                type="button"
                aria-label="Delete highlight"
                onClick={() => removeHighlight(h.id)}
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
