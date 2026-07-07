"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Highlighter,
  Languages,
  Loader2,
  Quote,
  Search,
  Wand2,
  X,
} from "lucide-react";
import { useReaderStore } from "@/lib/store/useReaderStore";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { callLlm } from "@/lib/llm";
import { HIGHLIGHT_COLORS, cn } from "@/lib/utils";
import type { EpubViewerHandle } from "./EpubViewer";
import type { HighlightColor, LlmAction, SelectionState } from "@/lib/types";

interface SelectionMenuProps {
  selection: SelectionState;
  bookId: string;
  viewerRef: React.RefObject<EpubViewerHandle | null>;
  onClose: () => void;
}

type Panel =
  | { kind: "idle" }
  | { kind: "loading"; action: LlmAction }
  | { kind: "result"; action: LlmAction; result: string; example?: string; error?: string };

export function SelectionMenu({ selection, bookId, viewerRef, onClose }: SelectionMenuProps) {
  const [panel, setPanel] = useState<Panel>({ kind: "idle" });
  const [showColors, setShowColors] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const targetLanguage = useSettingsStore((s) => s.targetLanguage);
  const addHighlight = useReaderStore((s) => s.addHighlight);
  const addQuote = useReaderStore((s) => s.addQuote);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (cardRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    function onScroll() {
      onClose();
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [onClose]);

  async function runAction(action: LlmAction) {
    setPanel({ kind: "loading", action });
    try {
      const ctx = selection.context;
      const res = await callLlm({
        action,
        text: selection.text,
        sentence: ctx?.currentSentence,
        prevSentence: ctx?.prevSentence,
        nextSentence: ctx?.nextSentence,
        isWord: ctx?.isWord,
        targetLanguage,
      });
      setPanel({ kind: "result", action, result: res.result, example: res.example });
    } catch (err) {
      setPanel({
        kind: "result",
        action,
        result: "",
        error: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  function doHighlight(color: HighlightColor) {
    const highlight = addHighlight({
      bookId,
      cfiRange: selection.cfiRange,
      text: selection.text,
      color,
    });
    viewerRef.current?.addHighlight(highlight);
    viewerRef.current?.clearSelection();
    setShowColors(false);
    onClose();
  }

  function doSaveQuote() {
    addQuote({
      bookId,
      text: selection.text,
      cfiRange: selection.cfiRange,
    });
    viewerRef.current?.clearSelection();
    onClose();
  }

  function doQuote() {
    const highlight = addHighlight({
      bookId,
      cfiRange: selection.cfiRange,
      text: selection.text,
      color: "yellow",
    });
    viewerRef.current?.addHighlight(highlight);
    addQuote({
      bookId,
      text: selection.text,
      cfiRange: selection.cfiRange,
    });
    viewerRef.current?.clearSelection();
    onClose();
  }

  function copyResult() {
    if (panel.kind !== "result") return;
    const text = [panel.result, panel.example].filter(Boolean).join("\n\n");
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  function copyText() {
    navigator.clipboard?.writeText(selection.text).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 1200);
    });
  }

  const variant = selection.variant ?? "full";

  // Double-tap on a single word: auto-run the translation immediately, no menu.
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (variant !== "instantTranslate" || autoRanRef.current) return;
    autoRanRef.current = true;
    void runAction("translate");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  const { rect } = selection;
  const vw = typeof window !== "undefined" ? window.innerWidth : 375;
  const vh = typeof window !== "undefined" ? window.innerHeight : 667;
  const placeAbove = rect.top > vh * 0.5;
  const centerX = rect.left + rect.width / 2;
  const cardWidth = Math.min(360, vw - 24);
  let left = centerX - cardWidth / 2;
  left = Math.max(12, Math.min(left, vw - cardWidth - 12));

  const verticalStyle: React.CSSProperties = placeAbove
    ? { bottom: vh - rect.top + 8 }
    : { top: rect.top + rect.height + 8 };

  const actionLabel: Record<LlmAction, string> = {
    simplify: "Simplify",
    translate: targetLanguage === "en-zh" ? "Translate (中)" : "Translate",
    define: "Dictionary",
  };

  return (
    <div
      ref={cardRef}
      className="fixed z-50 animate-pop-in"
      style={{ left, width: cardWidth, ...verticalStyle }}
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/30">
        {variant === "instantTranslate" ? (
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {actionLabel.translate}
            </span>
            <button
              type="button"
              onClick={() => {
                viewerRef.current?.clearSelection();
                onClose();
              }}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 py-1.5">
            <MenuButton label="Simplify" onClick={() => runAction("simplify")}>
              <Wand2 className="h-[18px] w-[18px]" />
            </MenuButton>
            <MenuButton
              label={actionLabel.translate}
              onClick={() => runAction("translate")}
            >
              <Languages className="h-[18px] w-[18px]" />
            </MenuButton>
            {variant === "range" ? (
              <MenuButton label="Quote" onClick={doQuote}>
                <Quote className="h-[18px] w-[18px]" />
              </MenuButton>
            ) : (
              <>
                <MenuButton label="Dictionary" onClick={() => runAction("define")}>
                  <Search className="h-[18px] w-[18px]" />
                </MenuButton>
                <MenuButton
                  label="Highlight"
                  active={showColors}
                  onClick={() => setShowColors((v) => !v)}
                >
                  <Highlighter className="h-[18px] w-[18px]" />
                </MenuButton>
                <MenuButton label="Copy text" onClick={copyText}>
                  {copiedText ? (
                    <Check className="h-[18px] w-[18px]" />
                  ) : (
                    <Copy className="h-[18px] w-[18px]" />
                  )}
                </MenuButton>
                <MenuButton label="Save quote" onClick={doSaveQuote}>
                  <Quote className="h-[18px] w-[18px]" />
                </MenuButton>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                viewerRef.current?.clearSelection();
                onClose();
              }}
              aria-label="Close"
              className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}

        {showColors && variant === "full" && (
          <div className="flex items-center gap-2 border-t border-border px-3 py-2">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-label={`Highlight ${c.key}`}
                onClick={() => doHighlight(c.key)}
                className={cn(
                  "h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-surface transition-transform active:scale-90",
                  c.ring
                )}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        )}

        {panel.kind !== "idle" && (
          <div className="border-t border-border px-3 py-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {panel.kind === "loading" ? actionLabel[panel.action] : actionLabel[panel.action]}
              </span>
              {panel.kind === "result" && !panel.error && (
                <button
                  type="button"
                  onClick={copyResult}
                  className="flex items-center gap-1 text-[11px] font-medium text-accent"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
            {panel.kind === "loading" ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking…
              </div>
            ) : panel.error ? (
              <p className="text-sm text-red-400">{panel.error}</p>
            ) : (
              <div className="space-y-2">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {panel.result}
                </p>
                {panel.example && (
                  <p className="border-l-2 border-accent/50 pl-2 text-[13px] italic leading-relaxed text-muted">
                    {panel.example}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuButton({
  label,
  children,
  onClick,
  active,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors",
        active ? "bg-accent/15 text-accent" : "text-foreground/80 hover:bg-surface-2"
      )}
    >
      {children}
    </button>
  );
}
