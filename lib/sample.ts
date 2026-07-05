import { useReaderStore } from "@/lib/store/useReaderStore";
import { getBookBytes, saveBookBytes } from "@/lib/idb";
import { bufferToBookMeta } from "@/lib/utils";

const SAMPLE_URL = "/sample.epub";
const SAMPLE_FILENAME = "sample.epub";

export async function ensureSampleBook(): Promise<string | null> {
  const store = useReaderStore.getState();
  const knownId = store.sampleBookId;

  if (knownId && store.books.some((b) => b.id === knownId)) {
    if (!store.hasBytes(knownId)) {
      const buf = await getBookBytes(knownId);
      if (buf) store.hydrateBytes(knownId, buf);
    }
    return knownId;
  }

  try {
    const resp = await fetch(SAMPLE_URL);
    if (!resp.ok) return null;
    const bytes = await resp.arrayBuffer();
    const meta = await bufferToBookMeta(SAMPLE_FILENAME, bytes);
    await saveBookBytes(meta.id, bytes);
    store.addBook(meta, bytes);
    store.setSampleBookId(meta.id);
    return meta.id;
  } catch (e) {
    console.error("Failed to load sample book:", e);
    return null;
  }
}
