import { NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import {
  getBookPath,
  getBookUrl,
  isBlobStorage,
  removeBook,
  listBooks,
  createReadStream,
} from "@/lib/server/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/library/[id] — serve a single EPUB file for reading.
 *
 * The id is a content hash (never a path). Disk mode streams the file from
 * the shared library directory; blob mode redirects to the book's Vercel
 * Blob URL (CORS-enabled, range-request-capable CDN).
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;

  if (isBlobStorage) {
    let blobUrl: string | null;
    try {
      blobUrl = await getBookUrl(id);
    } catch (err) {
      console.error("library get failed:", err);
      blobUrl = null;
    }
    if (!blobUrl) {
      return NextResponse.json(
        { error: "Book not found in the shared library." },
        { status: 404 },
      );
    }
    return NextResponse.redirect(blobUrl, 302);
  }

  let filePath: string | null;
  try {
    filePath = await getBookPath(id);
  } catch (err) {
    console.error("library get failed:", err);
    filePath = null;
  }

  if (!filePath) {
    return NextResponse.json(
      { error: "Book not found in the shared library." },
      { status: 404 },
    );
  }

  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return NextResponse.json(
      { error: "Book file is missing." },
      { status: 404 },
    );
  }

  const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/epub+zip",
      "Content-Length": String(size),
      "Content-Disposition": `inline; filename="${encodeURIComponent(id)}.epub"`,
      // EPUBs are shared reading material; don't cache stale bytes in the
      // browser since a file may be replaced/re-uploaded under the same id.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** DELETE /api/library/[id] — remove a book from the shared library. */
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const removed = await removeBook(id);
    const books = await listBooks();
    if (!removed) {
      return NextResponse.json(
        { error: "Book not found.", books },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, books });
  } catch (err) {
    console.error("library delete failed:", err);
    return NextResponse.json(
      { error: "Failed to remove the book." },
      { status: 500 },
    );
  }
}
