"use client";

import { useEffect, useState } from "react";
import { BookText } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { Library } from "@/components/Library";
import { TranslationsPanel } from "@/components/TranslationsPanel";
import { QuotesPanel } from "@/components/QuotesPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ReaderScreen } from "@/components/reader/ReaderScreen";
import { useReaderStore } from "@/lib/store/useReaderStore";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { fetchLibrary } from "@/lib/library-api";

export default function Home() {
  const hydrated = useHydrated();
  const [tab, setTab] = useState<Tab>("library");
  const [reading, setReading] = useState(false);
  const [focusCfi, setFocusCfi] = useState<string | undefined>(undefined);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const currentBookId = useReaderStore((s) => s.currentBookId);
  const setCurrentBook = useReaderStore((s) => s.setCurrentBook);
  const setBooks = useReaderStore((s) => s.setBooks);

  // Load the shared library from the server on first mount. The library is
  // server-authoritative (shared across all users), so we never preload a
  // sample book — it starts empty or with whatever has been uploaded.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void (async () => {
      try {
        const books = await fetchLibrary();
        if (!cancelled) setBooks(books);
      } catch (e) {
        console.error("Failed to load library:", e);
      } finally {
        if (!cancelled) setLoadingLibrary(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, setBooks]);

  function openBook(id: string, cfi?: string) {
    setCurrentBook(id);
    setFocusCfi(cfi);
    setReading(true);
  }

  function backToLibrary() {
    setReading(false);
    setFocusCfi(undefined);
  }

  if (reading && currentBookId) {
    return (
      <ReaderScreen
        key={currentBookId}
        bookId={currentBookId}
        focusCfi={focusCfi}
        onBack={backToLibrary}
      />
    );
  }

  const titles: Record<Tab, string> = {
    library: "Booker",
    translations: "Translations",
    quotes: "Quotes",
    settings: "Settings",
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <TopBar title={titles[tab]} right={<ThemeToggle />} />

      <main className="no-scrollbar flex-1 overflow-y-auto">
        {!hydrated || loadingLibrary ? (
          <Splash />
        ) : tab === "library" ? (
          <Library onOpen={openBook} />
        ) : tab === "translations" ? (
          <TranslationsPanel onOpen={openBook} />
        ) : tab === "quotes" ? (
          <QuotesPanel onOpen={openBook} />
        ) : (
          <SettingsPanel />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

function Splash() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2">
        <BookText className="h-6 w-6 text-accent" />
      </div>
    </div>
  );
}
