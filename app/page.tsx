"use client";

import { useEffect, useState } from "react";
import { BookText } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { Library } from "@/components/Library";
import { HighlightsPanel } from "@/components/HighlightsPanel";
import { QuotesPanel } from "@/components/QuotesPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ReaderScreen } from "@/components/reader/ReaderScreen";
import { useReaderStore } from "@/lib/store/useReaderStore";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { ensureSampleBook } from "@/lib/sample";

export default function Home() {
  const hydrated = useHydrated();
  const [tab, setTab] = useState<Tab>("library");
  const [reading, setReading] = useState(false);
  const [focusCfi, setFocusCfi] = useState<string | undefined>(undefined);
  const [bootstrapping, setBootstrapping] = useState(true);
  const currentBookId = useReaderStore((s) => s.currentBookId);
  const setCurrentBook = useReaderStore((s) => s.setCurrentBook);

  useEffect(() => {
    if (!hydrated || !bootstrapping) return;
    let cancelled = false;
    void (async () => {
      const id = await ensureSampleBook();
      if (cancelled) return;
      if (id) {
        setCurrentBook(id);
        setReading(true);
      }
      setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, bootstrapping, setCurrentBook]);

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
    highlights: "Highlights",
    quotes: "Quotes",
    settings: "Settings",
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <TopBar title={titles[tab]} right={<ThemeToggle />} />

      <main className="no-scrollbar flex-1 overflow-y-auto">
        {!hydrated || bootstrapping ? (
          <Splash />
        ) : tab === "library" ? (
          <Library onOpen={openBook} />
        ) : tab === "highlights" ? (
          <HighlightsPanel onOpen={openBook} />
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
