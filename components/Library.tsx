"use client";

import { useRef, useState } from "react";
import { BookOpen, Loader2, Trash2, Upload, User } from "lucide-react";
import { useReaderStore } from "@/lib/store/useReaderStore";
import { formatBytes } from "@/lib/utils";
import { uploadEpub, deleteEpub } from "@/lib/library-api";
import { deleteBook } from "@/lib/idb-books";
import type { BookMeta } from "@/lib/types";

interface LibraryProps {
  onOpen: (bookId: string) => void;
}

/**
 * Shared EPUB library view.
 *
 * Books live on the server (`library/epubs`) and are shared with every user.
 * Uploads go through the POST /api/library endpoint (which extracts Title +
 * Author from the EPUB's own metadata); deletions go through DELETE. Reading
 * progress is per-user and read from the local store.
 */
export function Library({ onOpen }: LibraryProps) {
  const books = useReaderStore((s) => s.books);
  const progressMap = useReaderStore((s) => s.progress);
  const setBooks = useReaderStore((s) => s.setBooks);
  const cloudBooks = useReaderStore((s) => s.cloudBooks);
  const removeCloudBook = useReaderStore((s) => s.removeCloudBook);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cloud-downloaded books are client-stored; merge them in for display,
  // skipping any whose id already matches a server book (same content).
  const serverIds = new Set(books.map((b) => b.id));
  const allBooks = [
    ...books,
    ...cloudBooks.filter((b) => !serverIds.has(b.id)),
  ];

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      let firstId: string | null = null;
      for (const file of Array.from(files)) {
        const { books: refreshed, uploaded } = await uploadEpub(file);
        setBooks(refreshed);
        if (firstId === null && uploaded[0]) firstId = uploaded[0].id;
      }
      if (firstId) onOpen(firstId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(b: BookMeta) {
    if (b.source === "cloud") {
      if (!window.confirm(`Remove "${b.title}" from your library?`)) return;
      setError(null);
      try {
        await deleteBook(b.id).catch(() => {});
        removeCloudBook(b.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed.");
      }
      return;
    }
    const ok = window.confirm(
      `Remove "${b.title}" from the shared library?\n\nThis affects every user and cannot be undone.`,
    );
    if (!ok) return;
    setError(null);
    try {
      const refreshed = await deleteEpub(b.id);
      setBooks(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  return (
    <div className="px-4 py-4">
      <input
        ref={fileRef}
        type="file"
        accept=".epub,application/epub+zip"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 py-6 text-sm font-medium text-foreground/80 transition-colors hover:bg-surface-2 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Upload className="h-5 w-5" />
        )}
        {busy ? "Importing…" : "Upload EPUB"}
      </button>

      {error && (
        <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {allBooks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {allBooks.map((b) => {
            const p = progressMap[b.id]?.percentage ?? 0;
            return (
              <div
                key={b.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <button
                  type="button"
                  onClick={() => onOpen(b.id)}
                  className="flex flex-1 flex-col items-start p-3 text-left"
                >
                  <div className="mb-3 grid h-28 w-full place-items-center rounded-xl bg-surface-2 text-muted">
                    <BookOpen className="h-8 w-8" />
                  </div>
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                    {b.title}
                  </h3>
                  <span className="mt-1 flex w-full items-center gap-1 text-[11px] text-muted">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {b.author || "Unknown author"}
                    </span>
                  </span>
                  <span className="mt-1 text-[10px] text-muted">
                    {formatBytes(b.size)}
                  </span>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.round(p * 100)}%` }}
                    />
                  </div>
                </button>
                <button
                  type="button"
                  aria-label="Remove book"
                  onClick={() => handleDelete(b)}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/70 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-surface-2 text-muted">
        <BookOpen className="h-8 w-8" />
      </div>
      <h3 className="text-base font-semibold">Your shared library is empty</h3>
      <p className="max-w-[18rem] text-sm text-muted">
        Upload an EPUB to add it to the shared library. Every book here is
        available to all readers. Your reading progress stays private to your
        device.
      </p>
    </div>
  );
}
