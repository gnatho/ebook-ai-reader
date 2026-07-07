/**
 * Client-side helpers for talking to the shared EPUB library API.
 *
 * All EPUBs live on the server in `library/epubs` and are shared across every
 * user. These functions wrap the `/api/library` endpoints so UI code stays
 * free of fetch boilerplate.
 */
import type { BookMeta } from "@/lib/types";

/** Fetch the full list of shared books (Title + Author + size + addedAt). */
export async function fetchLibrary(): Promise<BookMeta[]> {
  const res = await fetch("/api/library", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load the shared library.");
  const data = (await res.json()) as { books?: BookMeta[] };
  return data.books ?? [];
}

/**
 * Upload an EPUB to the shared library.
 * Returns the refreshed book list plus the newly stored books.
 */
export async function uploadEpub(
  file: File,
): Promise<{ books: BookMeta[]; uploaded: BookMeta[] }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/library", { method: "POST", body: form });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? `Upload failed (${res.status}).`);
  }
  return (await res.json()) as { books: BookMeta[]; uploaded: BookMeta[] };
}

/** Remove a book (by id) from the shared library; returns the refreshed list. */
export async function deleteEpub(id: string): Promise<BookMeta[]> {
  const res = await fetch(`/api/library/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? `Delete failed (${res.status}).`);
  }
  const data = (await res.json()) as { books?: BookMeta[] };
  return data.books ?? [];
}

/** URL the reader uses to fetch a book's bytes for rendering. */
export function bookFileUrl(id: string): string {
  return `/api/library/${encodeURIComponent(id)}`;
}
