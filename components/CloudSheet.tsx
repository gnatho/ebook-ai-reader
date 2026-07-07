"use client";

import { useEffect, useState } from "react";
import { Check, CloudDownload, Download, Loader2, X } from "lucide-react";
import { useReaderStore } from "@/lib/store/useReaderStore";
import { fetchCloudCatalog, fetchCloudBytes, cloudBookMeta } from "@/lib/cloud";
import { putBook } from "@/lib/idb-books";
import { formatBytes } from "@/lib/utils";
import type { CloudCatalogEntry } from "@/lib/types";

interface CloudSheetProps {
  onOpen: (id: string) => void;
  onClose: () => void;
}

export function CloudSheet({ onOpen, onClose }: CloudSheetProps) {
  const cloudBooks = useReaderStore((s) => s.cloudBooks);
  const addCloudBook = useReaderStore((s) => s.addCloudBook);
  const [entries, setEntries] = useState<CloudCatalogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCloudCatalog()
      .then((e) => {
        if (!cancelled) setEntries(e);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the cloud catalog.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ownedIds = new Set(cloudBooks.map((b) => b.id));

  async function handleDownload(entry: CloudCatalogEntry) {
    setBusyId(entry.id);
    setError(null);
    try {
      const bytes = await fetchCloudBytes(entry.rawUrl);
      await putBook(entry.id, bytes);
      addCloudBook(cloudBookMeta(entry));
      onOpen(entry.id);
    } catch {
      setError(`Couldn't download "${entry.title}".`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-background sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <CloudDownload className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-semibold">Cloud library</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-2 py-2">
          {error && (
            <p className="m-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
          {entries === null && !error && (
            <div className="flex items-center justify-center gap-2 py-10 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          )}
          {entries?.map((e) => {
            const owned = ownedIds.has(e.id);
            const busy = busyId === e.id;
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="truncate text-[11px] text-muted">
                    {e.author || "Unknown author"} · {formatBytes(e.size)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={owned || busy}
                  onClick={() => handleDownload(e)}
                  aria-label={owned ? "In your library" : `Download ${e.title}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-accent transition-colors hover:bg-surface-2 disabled:text-muted"
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : owned ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
