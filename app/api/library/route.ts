import { NextResponse } from "next/server";
import {
  listBooks,
  addBook,
  maxUploadBytes,
  LibraryError,
} from "@/lib/server/library";
import type { BookMeta } from "@/lib/types";

// Always read/write fresh — the shared library changes on disk at any time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/library — list all EPUBs in the shared library. */
export async function GET() {
  try {
    const books = await listBooks();
    return NextResponse.json({ books });
  } catch (err) {
    console.error("library list failed:", err);
    return NextResponse.json(
      { error: "Failed to read the shared library." },
      { status: 500 },
    );
  }
}

/** POST /api/library — upload one or more EPUBs (multipart `file` fields). */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data upload." },
      { status: 400 },
    );
  }

  const files = form.getAll("file").filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "No EPUB file provided." },
      { status: 400 },
    );
  }

  const uploaded: BookMeta[] = [];
  try {
    for (const file of files) {
      const bytes = await file.arrayBuffer();

      // Early size rejection before touching disk.
      if (bytes.byteLength > maxUploadBytes) {
        return NextResponse.json(
          { error: `"${file.name}" exceeds the 100 MB upload limit.` },
          { status: 413 },
        );
      }

      const meta = await addBook(file.name, bytes);
      uploaded.push(meta);
    }
  } catch (err) {
    if (err instanceof LibraryError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("library upload failed:", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }

  // Return the refreshed shared list plus the freshly stored books so the
  // client can update its state and open the first uploaded book.
  const books = await listBooks();
  return NextResponse.json({ books, uploaded });
}
