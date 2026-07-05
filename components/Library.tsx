"use client";

import { useRef, useState } from "react";
import { BookOpen, FileText, Trash2, Upload } from "lucide-react";
import { useReaderStore } from "@/lib/store/useReaderStore";
import {
  fileToBookMeta,
  formatBytes,
  readFileAsArrayBuffer,
} from "@/lib/utils";
import { saveBookBytes, deleteBookBytes } from "@/lib/idb";

interface LibraryProps {
  onOpen: (bookId: string) => void;
}

export function Library({ onOpen }: LibraryProps) {
  const books = useReaderStore((s) => s.books);
  const progressMap = useReaderStore((s) => s.progress);
  const addBook = useReaderStore((s) => s.addBook);
  const removeBook = useReaderStore((s) => s.removeBook);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    setBusy(true);
    try {
      let firstId: string | null = null;
      for (const file of fileArr) {
        const meta = await fileToBookMeta(file);
        const bytes = await readFileAsArrayBuffer(file);
        await saveBookBytes(meta.id, bytes);
        addBook(meta, bytes);
        if (firstId === null) firstId = meta.id;
      }
      if (firstId) onOpen(firstId);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-4">
      <input
        ref={fileRef}
        type="file"
        accept=".epub,.txt,application/epub+zip,text/plain"
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
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 py-6 text-sm font-medium text-foreground/80 transition-colors hover:bg-surface-2"
      >
        <Upload className="h-5 w-5" />
        {busy ? "Importing…" : "Upload EPUB or TXT"}
      </button>

      {books.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {books.map((b) => {
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
                  <div className="mb-3 grid h-24 w-full place-items-center rounded-xl bg-surface-2 text-muted">
                    {b.format === "epub" ? (
                      <BookOpen className="h-8 w-8" />
                    ) : (
                      <FileText className="h-8 w-8" />
                    )}
                  </div>
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                    {b.title}
                  </h3>
                  <span className="mt-1 text-[11px] text-muted">
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
                  onClick={async () => {
                    await deleteBookBytes(b.id);
                    removeBook(b.id);
                  }}
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
      <h3 className="text-base font-semibold">Your library is empty</h3>
      <p className="max-w-[16rem] text-sm text-muted">
        Upload an EPUB or TXT file to start reading. Your progress and
        highlights are saved on this device.
      </p>
    </div>
  );
}
