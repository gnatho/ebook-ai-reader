"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Settings, Loader2, AlertCircle } from "lucide-react";
import { TopBar, BackButton } from "@/components/TopBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { FullscreenToggle } from "@/components/FullscreenToggle";
import { EpubViewer, type EpubViewerHandle } from "./EpubViewer";
import { SelectionMenu } from "./SelectionMenu";
import { ReaderSettingsSheet } from "./ReaderSettingsSheet";
import { useReaderStore } from "@/lib/store/useReaderStore";
import { bookFileUrl } from "@/lib/library-api";
import { getBook } from "@/lib/idb-books";
import { fetchCloudBytes } from "@/lib/cloud";
import type { SelectionState } from "@/lib/types";

interface ReaderScreenProps {
  bookId: string;
  focusCfi?: string;
  onBack: () => void;
}

export function ReaderScreen({ bookId, focusCfi, onBack }: ReaderScreenProps) {
  const book = useReaderStore(
    (s) => s.books.find((b) => b.id === bookId) ?? s.cloudBooks.find((b) => b.id === bookId),
  );
  const saveProgress = useReaderStore((s) => s.saveProgress);
  const getProgress = useReaderStore((s) => s.getProgress);

  const viewerRef = useRef<EpubViewerHandle>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [selKey, setSelKey] = useState(0);
  const [progress, setProgress] = useState(() => getProgress(bookId));
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const state = useReaderStore.getState();
        const meta =
          state.books.find((b) => b.id === bookId) ??
          state.cloudBooks.find((b) => b.id === bookId);
        let buf: ArrayBuffer | undefined;
        if (meta?.source === "cloud") {
          // Cloud books are cached in IndexedDB; fall back to GitHub.
          buf =
            (await getBook(bookId)) ??
            (meta.cloudUrl ? await fetchCloudBytes(meta.cloudUrl) : undefined);
        } else {
          const res = await fetch(bookFileUrl(bookId));
          if (!res.ok) {
            throw new Error("not-found");
          }
          buf = await res.arrayBuffer();
        }
        if (cancelled) return;
        if (!buf) throw new Error("not-found");
        setBytes(buf);
      } catch {
        if (!cancelled) {
          setError(
            "Could not load this book. It may have been removed from the shared library."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <TopBar
        title={book?.title ?? "Reading"}
        subtitle={book?.author}
        left={<BackButton onClick={onBack} />}
        right={
          <>
            <LanguageToggle />
            <FullscreenToggle />
            <button
              type="button"
              aria-label="Reader settings"
              onClick={() => setSettingsOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full text-foreground/80 transition-colors hover:bg-surface-2 active:scale-95"
            >
              <Settings className="h-5 w-5" />
            </button>
            <ThemeToggle />
          </>
        }
      />

      <div className="relative flex-1 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Opening book…</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-muted">{error}</p>
            <button
              type="button"
              onClick={onBack}
              className="rounded-full bg-surface-2 px-4 py-2 text-sm font-medium text-foreground"
            >
              Back to library
            </button>
          </div>
        )}

        {bytes && !error && (
          <EpubViewer
            ref={viewerRef}
            bookId={bookId}
            bytes={bytes}
            onReady={() => {
              setLoading(false);
              if (focusCfi) {
                viewerRef.current?.display(focusCfi).catch(() => {});
              }
            }}
            onError={(msg) => {
              setError(msg);
              setLoading(false);
            }}
            onRelocated={(loc) => {
              const next = {
                bookId,
                cfi: loc.cfi,
                percentage: loc.percentage,
                updatedAt: Date.now(),
              };
              saveProgress(next);
              setProgress(next);
            }}
            onSelection={(sel) => {
              setSelKey((k) => k + 1);
              setSelection(sel);
            }}
            onSelectionCleared={() => setSelection(null)}
          />
        )}

        {selection && (
          <SelectionMenu
            key={selKey}
            selection={selection}
            bookId={bookId}
            viewerRef={viewerRef}
            onClose={() => {
              viewerRef.current?.clearSelection();
              setSelection(null);
            }}
          />
        )}
      </div>

      <ReaderControls
        percentage={progress?.percentage ?? 0}
        disabled={loading || !!error}
        onPrev={() => viewerRef.current?.prev()}
        onNext={() => viewerRef.current?.next()}
      />

      <ReaderSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function ReaderControls({
  percentage,
  disabled,
  onPrev,
  onNext,
}: {
  percentage: number;
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const pct = Math.max(0, Math.min(1, percentage));
  return (
    <div
      className="z-30 flex items-center gap-3 border-t border-border bg-background/90 px-4 py-2 backdrop-blur-md"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <NavBtn onClick={onPrev} label="Previous page" disabled={disabled}>
        <ChevronLeft className="h-5 w-5" />
      </NavBtn>
      <div className="flex flex-1 flex-col items-center gap-1">
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <span className="text-[11px] tabular-nums text-muted">
          {Math.round(pct * 100)}%
        </span>
      </div>
      <NavBtn onClick={onNext} label="Next page" disabled={disabled}>
        <ChevronRight className="h-5 w-5" />
      </NavBtn>
    </div>
  );
}

function NavBtn({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-10 w-10 place-items-center rounded-full text-foreground/80 transition-colors hover:bg-surface-2 active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
