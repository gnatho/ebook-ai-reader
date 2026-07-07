/**
 * Server-side shared EPUB library.
 *
 * All EPUBs live in a single shared folder (`library/epubs/` by default) and
 * are visible to every user. Book bytes are stored on disk; metadata is
 * extracted once per file (see `epub-meta.ts`) and cached in a small manifest
 * so listing the library stays fast.
 *
 * Security for multi-user shared access:
 *  - Files are addressed only by a content-hash `id`, never by user-supplied
 *    paths. Every filename written to disk is sanitized and uniqueness-checked.
 *  - `getBookPath` resolves an id to a real path and verifies the resolved
 *    path stays inside the library directory (defence against traversal).
 *  - Uploads are validated: `.epub` extension + ZIP magic bytes + size cap.
 *  - All manifest mutations are serialized with an in-process lock so
 *    concurrent uploads from multiple users can't corrupt the manifest.
 *
 * This module is Node-only.
 */
import { promises as fs } from "node:fs";
import { createReadStream } from "node:fs";
import path from "node:path";
import type { BookMeta } from "@/lib/types";
import { hashBytes } from "@/lib/hash";
import { extractEpubMetadata } from "./epub-meta";

/** Maximum accepted upload size (100 MB). */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Root directory of the shared library. Defaults to `library/epubs` under the
 * process working directory (the project root in both `next dev` and
 * `next start`). Override with the `LIBRARY_DIR` env var for deployments.
 */
export const LIBRARY_DIR = path.resolve(
  process.env.LIBRARY_DIR || "library/epubs",
);

const MANIFEST_FILENAME = ".manifest.json";
const MANIFEST_PATH = path.join(LIBRARY_DIR, MANIFEST_FILENAME);

/** User-facing validation errors (mapped to HTTP 400 by route handlers). */
export class LibraryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LibraryError";
  }
}

interface ManifestEntry {
  id: string;
  title: string;
  author?: string;
  format: "epub";
  size: number;
  addedAt: number;
  /** `${size}:${mtimeMs}` — used to cheaply detect changed/unchanged files. */
  cacheKey: string;
}

interface Manifest {
  version: 1;
  books: Record<string, ManifestEntry>;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** List every EPUB in the shared library, newest first. */
export async function listBooks(): Promise<BookMeta[]> {
  return withLock(async () => {
    await ensureDir();
    const files = await readEpubFiles();
    const manifest = await readManifest();
    const next: Record<string, ManifestEntry> = {};
    let changed = false;

    for (const filename of files) {
      const filePath = path.join(LIBRARY_DIR, filename);
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat || !stat.isFile()) continue;

      const cacheKey = `${stat.size}:${stat.mtimeMs}`;
      const prev = manifest.books[filename];
      let entry: ManifestEntry;

      if (prev && prev.cacheKey === cacheKey) {
        // Unchanged file — reuse the cached metadata entry.
        entry = prev;
      } else {
        // New or modified file — re-extract metadata.
        const bytes = await fs.readFile(filePath);
        entry = await buildEntry(filename, bytes, stat.size, stat.mtimeMs);
        changed = true;
      }
      next[filename] = entry;
    }

    // Detect removed files.
    if (Object.keys(manifest.books).some((f) => !next[f])) changed = true;

    if (changed) {
      // Best-effort: read-only deployments (e.g. Vercel serverless) can't
      // persist the manifest, but the in-memory result below is still valid.
      await writeManifest({ version: 1, books: next }).catch(() => {});
    }

    return Object.values(next)
      .map(toBookMeta)
      .sort((a, b) => b.addedAt - a.addedAt);
  });
}

/**
 * Resolve a book id to an absolute filesystem path, verifying the resolved
 * path remains inside the library directory. Returns `null` if not found or
 * the path would escape the library (path traversal attempt).
 */
export async function getBookPath(id: string): Promise<string | null> {
  return withLock(async () => {
    const manifest = await readManifest();
    const filename = findFilenameById(manifest, id);
    if (!filename || !isSafeFilename(filename)) return null;

    const filePath = path.join(LIBRARY_DIR, filename);
    const realPath = await fs.realpath(filePath).catch(() => null);
    const realDir = await fs.realpath(LIBRARY_DIR).catch(() => LIBRARY_DIR);
    if (!realPath) return null;
    // Ensure the resolved file lives directly inside the library dir.
    if (path.dirname(realPath) !== realDir) return null;
    return realPath;
  });
}

/**
 * Store an uploaded EPUB in the shared library and return its metadata.
 * Duplicate uploads (same content hash) return the existing entry instead of
 * storing a second copy.
 */
export async function addBook(
  originalName: string,
  bytes: ArrayBuffer | Uint8Array,
): Promise<BookMeta> {
  return withLock(async () => {
    await ensureDir();
    validateEpub(originalName, bytes);

    const id = hashBytes(bytes);
    const manifest = await readManifest();

    // Deduplicate by content hash.
    const existing = findFilenameById(manifest, id);
    if (existing) {
      return toBookMeta(manifest.books[existing]);
    }

    const filename = await pickUniqueFilename(id, originalName);
    const filePath = path.join(LIBRARY_DIR, filename);

    // Atomic write: temp file + rename so a crash never leaves a partial epub.
    const tmpPath = `${filePath}.part`;
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    await fs.writeFile(tmpPath, Buffer.from(data));
    await fs.rename(tmpPath, filePath);

    const stat = await fs.stat(filePath);
    const entry = await buildEntry(
      filename,
      bytes,
      stat.size,
      stat.mtimeMs,
    );

    manifest.books[filename] = entry;
    await writeManifest(manifest);
    return toBookMeta(entry);
  });
}

/** Remove a book (by id) from the shared library. Returns false if absent. */
export async function removeBook(id: string): Promise<boolean> {
  return withLock(async () => {
    const manifest = await readManifest();
    const filename = findFilenameById(manifest, id);
    if (!filename) return false;

    if (isSafeFilename(filename)) {
      await fs.rm(path.join(LIBRARY_DIR, filename), { force: true });
    }
    delete manifest.books[filename];
    await writeManifest(manifest);
    return true;
  });
}

/** Expose the upload size cap to route handlers for early rejection. */
export const maxUploadBytes = MAX_UPLOAD_BYTES;

/** Re-export for the streaming route handler (avoids a separate import). */
export { createReadStream };

/* ------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------ */

function findFilenameById(
  manifest: Manifest,
  id: string,
): string | null {
  for (const [filename, entry] of Object.entries(manifest.books)) {
    if (entry.id === id) return filename;
  }
  return null;
}

function toBookMeta(entry: ManifestEntry): BookMeta {
  return {
    id: entry.id,
    title: entry.title,
    author: entry.author,
    format: "epub",
    size: entry.size,
    addedAt: entry.addedAt,
  };
}

/** Build a manifest entry by hashing the bytes + extracting EPUB metadata. */
async function buildEntry(
  _filename: string,
  bytes: ArrayBuffer | Uint8Array,
  size: number,
  mtimeMs: number,
): Promise<ManifestEntry> {
  const id = hashBytes(bytes);
  const { title, author } = await extractEpubMetadata(bytes, _filename);
  return {
    id,
    title,
    author,
    format: "epub",
    size,
    addedAt: Math.round(mtimeMs),
    cacheKey: `${size}:${mtimeMs}`,
  };
}

/** Validate that the uploaded blob looks like an EPUB. Throws LibraryError. */
function validateEpub(name: string, bytes: ArrayBuffer | Uint8Array): void {
  const lower = name.toLowerCase();
  if (!lower.endsWith(".epub")) {
    throw new LibraryError("Only .epub files are supported.");
  }
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view.length < 4) {
    throw new LibraryError("The file is too small to be a valid EPUB.");
  }
  // ZIP magic bytes: PK\x03\x04 (local file header), or PK\x05\x06 / PK\x07\x08.
  const isZip =
    view[0] === 0x50 &&
    view[1] === 0x4b &&
    (view[2] === 0x03 || view[2] === 0x05 || view[2] === 0x07);
  if (!isZip) {
    throw new LibraryError("The file does not appear to be a valid EPUB.");
  }
  if (view.length > MAX_UPLOAD_BYTES) {
    throw new LibraryError("The file exceeds the 100 MB upload limit.");
  }
}

/** Produce a safe, unique on-disk filename for an uploaded EPUB. */
async function pickUniqueFilename(
  id: string,
  originalName: string,
): Promise<string> {
  const base = sanitizeBaseName(originalName);
  // Prefix with a short slice of the content hash to guarantee uniqueness
  // while keeping the human-readable original name for admins browsing disk.
  const shortId = id.slice(3, 11);
  let candidate = `${shortId}__${base}`;

  const existing = new Set(await readEpubFiles());
  if (!existing.has(candidate)) return candidate;

  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : ".epub";
  for (let i = 2; i < 1000; i++) {
    candidate = `${shortId}__${stem} (${i})${ext}`;
    if (!existing.has(candidate)) return candidate;
  }
  // Extremely unlikely fallback.
  return `${shortId}__${Date.now().toString(36)}.epub`;
}

/** Strip path components and unsafe characters from an uploaded filename. */
function sanitizeBaseName(name: string): string {
  const raw = path.basename(name).replace(/\.epub$/i, "");
  const safe = raw
    .replace(/[^a-zA-Z0-9 _.\-()]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${safe || "book"}.epub`;
}

/** A filename is safe if it has no path separators or traversal segments. */
function isSafeFilename(name: string): boolean {
  return (
    !!name &&
    !name.includes("/") &&
    !name.includes("\\") &&
    !name.includes("..") &&
    name !== MANIFEST_FILENAME
  );
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(LIBRARY_DIR, { recursive: true });
}

async function readEpubFiles(): Promise<string[]> {
  try {
    const entries = await fs.readdir(LIBRARY_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && /\.epub$/i.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

async function readManifest(): Promise<Manifest> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Manifest>;
    if (parsed && parsed.version === 1 && parsed.books) {
      return { version: 1, books: parsed.books };
    }
  } catch {
    // Missing/corrupt manifest — start fresh.
  }
  return { version: 1, books: {} };
}

async function writeManifest(manifest: Manifest): Promise<void> {
  await ensureDir();
  const tmp = `${MANIFEST_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(manifest, null, 2), "utf8");
  await fs.rename(tmp, MANIFEST_PATH);
}

/**
 * Serialize manifest mutations across concurrent requests (multi-user uploads)
 * using a single promise chain. Read-only `listBooks` is also serialized for
 * simplicity and to always observe a consistent on-disk state.
 */
let chain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run as Promise<T>;
}
