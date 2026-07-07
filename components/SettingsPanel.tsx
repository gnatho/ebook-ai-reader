"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { SettingsControls } from "@/components/SettingsControls";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { useReaderStore } from "@/lib/store/useReaderStore";

export function SettingsPanel() {
  const reset = useSettingsStore((s) => s.reset);
  const books = useReaderStore((s) => s.books);
  const translations = useReaderStore((s) => s.translations);
  const quotes = useReaderStore((s) => s.quotes);

  // Clears only this user's local reading data. Shared library books live on
  // the server and are intentionally left untouched (they belong to everyone).
  function clearLocalData() {
    if (
      !confirm(
        "Clear your local reading data (progress, translations, quotes, settings) on this device?\n\nShared library books are not affected."
      )
    ) {
      return;
    }
    localStorage.removeItem("ebook-reader:settings");
    localStorage.removeItem("ebook-reader:reader");
    window.location.reload();
  }

  return (
    <div className="px-4 py-4">
      <SettingsControls />

      <div className="mt-6 flex items-center justify-between rounded-xl border border-border px-4 py-3">
        <div>
          <div className="text-sm font-medium">Reset reading defaults</div>
          <div className="text-xs text-muted">
            Restore font, theme & language defaults
          </div>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground/80 hover:bg-surface-2"
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-border px-4 py-3">
        <div className="mb-1 text-sm font-medium">Library</div>
        <div className="text-xs text-muted">
          {books.length} books in the shared library ·{" "}
          {translations.length} translations · {quotes.length} quotes saved on
          this device.
        </div>
      </div>

      <button
        type="button"
        onClick={clearLocalData}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10"
      >
        <Trash2 className="h-4 w-4" /> Clear my local data
      </button>
    </div>
  );
}
