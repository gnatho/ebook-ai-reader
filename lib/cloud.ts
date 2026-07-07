import type { BookMeta, CloudCatalogEntry } from "@/lib/types";

// Public GitHub repo hosting the seeded EPUB library. Books are fetched on
// demand from raw.githubusercontent.com (CORS-enabled, no token/rate-limit)
// so the Vercel deployment stays slim — no EPUBs are bundled server-side.
const OWNER = "gnatho";
const REPO = "ebook-ai-reader";
const BRANCH = "main";
const EPUB_DIR = "library/epubs";
const MANIFEST_FILE = ".manifest.json";

export function rawUrlForPath(path: string): string {
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;
}

interface ManifestEntry {
  id: string;
  title: string;
  author?: string;
  format: string;
  size: number;
  addedAt: number;
}
interface Manifest {
  version: number;
  books: Record<string, ManifestEntry>;
}

/** Fetch the cloud catalog (the committed .manifest.json) from GitHub. */
export async function fetchCloudCatalog(): Promise<CloudCatalogEntry[]> {
  const res = await fetch(rawUrlForPath(`${EPUB_DIR}/${MANIFEST_FILE}`), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load the cloud catalog.");
  const manifest = (await res.json()) as Manifest;
  return Object.entries(manifest.books ?? {})
    .map(([filename, e]) => ({
      id: e.id,
      title: e.title,
      author: e.author,
      size: e.size,
      addedAt: e.addedAt,
      filename,
      rawUrl: rawUrlForPath(`${EPUB_DIR}/${filename}`),
    }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

/** Download a single EPUB's bytes from GitHub. */
export async function fetchCloudBytes(rawUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(rawUrl);
  if (!res.ok) throw new Error("Failed to download the book.");
  return res.arrayBuffer();
}

/** Build the locally-stored BookMeta for a downloaded cloud book. */
export function cloudBookMeta(entry: CloudCatalogEntry): BookMeta {
  return {
    id: entry.id,
    title: entry.title,
    author: entry.author,
    format: "epub",
    size: entry.size,
    addedAt: entry.addedAt,
    source: "cloud",
    cloudUrl: entry.rawUrl,
  };
}
