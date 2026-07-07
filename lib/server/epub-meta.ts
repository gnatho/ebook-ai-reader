/**
 * Server-side EPUB metadata extraction.
 *
 * An EPUB is a ZIP archive. We use `jszip` to read it without touching the
 * filesystem, then locate the Package Document (`.opf`) via
 * `META-INF/container.xml` and pull the Dublin Core `title` and `creator`
 * (author) fields directly out of the book's own metadata — never from the
 * filename. If the embedded metadata is missing or unreadable we gracefully
 * fall back to a cleaned-up filename.
 *
 * This module is Node-only (it is imported by route handlers / the shared
 * library backend) and must never be imported from client code.
 */
import JSZip from "jszip";

export interface EpubMetadata {
  title: string;
  author?: string;
}

/**
 * Extract Title and Author (creator) from an EPUB's embedded metadata.
 *
 * @param bytes     The raw EPUB file bytes (ArrayBuffer or Uint8Array).
 * @param fallback  Filename used to derive a title when metadata is absent.
 */
export async function extractEpubMetadata(
  bytes: ArrayBuffer | Uint8Array,
  fallback: string,
): Promise<EpubMetadata> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    // Not a readable ZIP — fall back to the filename.
    return { title: fallbackTitle(fallback) };
  }

  // 1. Resolve the root Package Document (.opf) path from container.xml.
  const containerFile = zip.file("META-INF/container.xml");
  let opfPath: string | null = null;
  if (containerFile) {
    const containerXml = await containerFile.async("string");
    opfPath = extractOpfPath(containerXml);
  }
  // Fallback: pick the first .opf entry in the archive.
  if (!opfPath) {
    opfPath =
      Object.keys(zip.files).find((p) => /\.opf$/i.test(p)) ?? null;
  }
  if (!opfPath) {
    return { title: fallbackTitle(fallback) };
  }

  const opfFile = zip.file(opfPath) ?? zip.file(opfPath.toLowerCase());
  if (!opfFile) {
    return { title: fallbackTitle(fallback) };
  }

  const opfXml = await opfFile.async("string");
  const metadata = extractMetadataBlock(opfXml);

  const rawTitle =
    firstElementText(metadata, "title") ??
    firstElementText(opfXml, "title") ??
    fallbackTitle(fallback);
  const author = extractAuthor(metadata);

  return {
    title: cleanText(rawTitle) || fallbackTitle(fallback),
    author: author ? cleanText(author) : undefined,
  };
}

/** Read `full-path="..."` from the `<rootfile>` element in container.xml. */
function extractOpfPath(containerXml: string): string | null {
  const m = containerXml.match(
    /<rootfile\b[^>]*\bfull-path\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  );
  if (!m) return null;
  return decodeXml(m[1] ?? m[2] ?? "");
}

/** Isolate the `<metadata>...</metadata>` block; fall back to the whole OPF. */
function extractMetadataBlock(opfXml: string): string {
  const m = opfXml.match(/<metadata\b[\s>][\s\S]*?<\/metadata>/i);
  return m ? m[0] : opfXml;
}

/**
 * Return the inner text of the first element with the given local name,
 * supporting any (or no) namespace prefix, e.g. `<dc:title>` and `<title>`.
 */
function firstElementText(xml: string, localName: string): string | null {
  // Prefixed form, e.g. <dc:title ...>text</dc:title> (closing prefix must match).
  const prefixed = new RegExp(
    `<([a-zA-Z_][\\w.\\-]*):${localName}\\b[^>]*>([\\s\\S]*?)<\\/\\1:${localName}>`,
    "i",
  );
  let m = xml.match(prefixed);
  if (m) return m[2];

  // Unprefixed form, e.g. <title>text</title>.
  const unprefixed = new RegExp(
    `<${localName}\\b[^>]*>([\\s\\S]*?)<\\/${localName}>`,
    "i",
  );
  m = xml.match(unprefixed);
  return m ? m[1] : null;
}

interface Creator {
  text: string;
  role?: string;
  id?: string;
}

/** Collect every `<dc:creator>` element with its role/id attributes and text. */
function extractCreators(metadata: string): Creator[] {
  const creators: Creator[] = [];
  const re = new RegExp(
    `<([a-zA-Z_][\\w.\\-]*:)?creator\\b([^>]*)>([\\s\\S]*?)<\\/\\1?creator>`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(metadata)) !== null) {
    const attrs = m[2] ?? "";
    const text = decodeXml(stripTags(m[3] ?? "")).trim();
    if (!text) continue;
    creators.push({
      text,
      role: matchAttr(attrs, "role")?.toLowerCase(),
      id: matchAttr(attrs, "id") ?? undefined,
    });
  }
  return creators;
}

/**
 * Resolve the author string.
 *
 * Prefers creators explicitly marked as the author (`opf:role="aut"` in
 * EPUB 2, or refined via `<meta property="role">aut</meta>` in EPUB 3).
 * Falls back to the first creator. Multiple names are joined with ", ".
 */
function extractAuthor(metadata: string): string | null {
  const creators = extractCreators(metadata);
  if (creators.length === 0) return null;

  const autIds = collectAuthorRoleIds(metadata);
  const authors = creators.filter(
    (c) => c.role === "aut" || (c.id != null && autIds.has(c.id)),
  );
  const chosen = authors.length > 0 ? authors : creators;
  const names = chosen.map((c) => c.text).filter(Boolean);
  return names.length > 0 ? names.join(", ") : null;
}

/** EPUB 3: find creator ids refined with `property="role"` + text `aut`. */
function collectAuthorRoleIds(metadata: string): Set<string> {
  const ids = new Set<string>();
  const re = /<meta\b([^>]*)(?:\/>|>([\s\S]*?)<\/meta>)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(metadata)) !== null) {
    const attrs = m[1] ?? "";
    const text = (m[2] ?? "").trim().toLowerCase();
    const property = (matchAttr(attrs, "property") ?? "").toLowerCase();
    const refines = matchAttr(attrs, "refines"); // e.g. "#creator01"
    if (property === "role" && text === "aut" && refines) {
      ids.add(refines.replace(/^#/, ""));
    }
  }
  return ids;
}

/** Read a single attribute value (double or single quoted) from an attribute string. */
function matchAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  const m = attrs.match(re);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

/** Strip any nested tags and collapse whitespace. */
function cleanText(s: string): string {
  return decodeXml(stripTags(s)).replace(/\s+/g, " ").trim();
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

/** Decode the common XML entities (named + numeric). `&amp;` last to be safe. */
function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      safeFromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, d) => safeFromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function safeFromCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

/** Derive a readable title from a filename when metadata is unavailable. */
function fallbackTitle(name: string): string {
  return (
    name
      .replace(/\.epub$/i, "")
      .replace(/[_-]+/g, " ")
      .trim() || name
  );
}
