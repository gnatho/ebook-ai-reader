"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { Book, Rendition, Contents } from "epubjs";
import { useSettingsStore, fontFamilyStack } from "@/lib/store/useSettingsStore";
import { useReaderStore } from "@/lib/store/useReaderStore";
import { cn } from "@/lib/utils";
import { extractSelectionContext } from "@/lib/sentenceContext";
import {
  buildSelectionState,
  setSelectionRange,
  sameRange,
  spanningRange,
  wordRangeAtPoint,
} from "@/lib/readerSelection";
import type { SelectionState, SelectionVariant } from "@/lib/types";

export interface EpubViewerHandle {
  next: () => void;
  prev: () => void;
  display: (target: string) => Promise<void>;
  clearSelection: () => void;
}

interface EpubViewerProps {
  bookId: string;
  bytes: ArrayBuffer;
  className?: string;
  onReady?: () => void;
  onRelocated?: (loc: {
    cfi: string;
    percentage: number;
    atStart: boolean;
    atEnd: boolean;
  }) => void;
  onSelection?: (sel: SelectionState) => void;
  onSelectionCleared?: () => void;
  onError?: (msg: string) => void;
}

const DARK_THEME = {
  body: { background: "#0c0c0e", color: "#e6e6e6" },
  p: { color: "#e6e6e6" },
  "h1,h2,h3,h4,h5,h6": { color: "#fafafa" },
  a: { color: "#818cf8" },
  img: { "max-width": "100%" },
};

const LIGHT_THEME = {
  body: { background: "#f7f7f5", color: "#1a1a1a" },
  p: { color: "#1a1a1a" },
  "h1,h2,h3,h4,h5,h6": { color: "#0a0a0a" },
  a: { color: "#4f46e5" },
  img: { "max-width": "100%" },
};

interface SwipeState {
  active: boolean;
  decided: boolean;
  horizontal: boolean;
  startScreenX: number;
  startScreenY: number;
  startScrollLeft: number;
  lastTime: number;
  lastX: number;
  velocity: number;
  navigating: boolean;
  tapClientX: number;
  tapClientY: number;
  tapTarget: Element | null;
  tapMoved: boolean;
  tapLongPressed: boolean;
}

const SWIPE_DIR_LOCK = 8;
const SWIPE_TURN_RATIO = 0.3;
const SWIPE_FLICK_V = 0.6;
const SWIPE_ANIM_MS = 220;

const LONG_PRESS_MS = 500;
const LONG_PRESS_TOLERANCE = 12;

type EpubManagerLike = {
  container?: HTMLElement;
  layout?: { delta?: number };
};

function getScroller(
  rendition: Rendition
): { container: HTMLElement; delta: number; maxScroll: number } | null {
  const manager = (rendition as unknown as { manager?: EpubManagerLike }).manager;
  const container = manager?.container;
  const delta = manager?.layout?.delta;
  if (!container || typeof delta !== "number" || delta <= 0) return null;
  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
  return { container, delta, maxScroll };
}

function eachContents(rendition: Rendition): Array<{
  window?: { getSelection?: () => Selection | null };
}> {
  const list = (
    rendition as unknown as { getContents?: () => unknown }
  ).getContents?.();
  if (Array.isArray(list)) return list as Array<{ window?: { getSelection?: () => Selection | null } }>;
  return list != null
    ? [list as { window?: { getSelection?: () => Selection | null } }]
    : [];
}

function clearSelectionInIframe(rendition: Rendition): void {
  for (const c of eachContents(rendition)) {
    const sel = c?.window?.getSelection?.();
    sel?.removeAllRanges?.();
  }
}

export const EpubViewer = forwardRef<EpubViewerHandle, EpubViewerProps>(
  function EpubViewer(
    { bookId, bytes, className, onReady, onRelocated, onSelection, onSelectionCleared, onError },
    ref
  ) {
    const mountRef = useRef<HTMLDivElement>(null);
    const renditionRef = useRef<Rendition | null>(null);
    const bookRef = useRef<Book | null>(null);
    const settings = useSettingsStore();
    const callbacksRef = useRef({ onReady, onRelocated, onSelection, onSelectionCleared, onError });
    callbacksRef.current = { onReady, onRelocated, onSelection, onSelectionCleared, onError };
    const swipeRef = useRef<SwipeState>({
      active: false,
      decided: false,
      horizontal: false,
      startScreenX: 0,
      startScreenY: 0,
      startScrollLeft: 0,
      lastTime: 0,
      lastX: 0,
      velocity: 0,
      navigating: false,
      tapClientX: 0,
      tapClientY: 0,
      tapTarget: null,
      tapMoved: false,
      tapLongPressed: false,
    });
    const rafRef = useRef<number | null>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mouseLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    const suppressSelectedUntilRef = useRef(0);
    const pendingWordRef = useRef<{
      range: Range;
      contents: Contents;
    } | null>(null);
    const mouseTapRef = useRef<{
      x: number;
      y: number;
      target: Element | null;
      moved: boolean;
      longClicked: boolean;
    } | null>(null);

    function applySettings() {
      const rendition = renditionRef.current;
      if (!rendition) return;
      rendition.themes.fontSize(`${Math.round((settings.fontSize / 16) * 100)}%`);
      rendition.themes.font(fontFamilyStack(settings.fontFamily));
      rendition.themes.override("line-height", String(settings.lineHeight), true);
      rendition.themes.override(
        "letter-spacing",
        `${settings.letterSpacing}em`,
        true
      );
      rendition.themes.override("font-family", fontFamilyStack(settings.fontFamily), true);
      rendition.themes.override("touch-action", "pan-y", true);
      rendition.themes.override("overscroll-behavior", "none", true);
      // Keep native text selection enabled so users can drag-select words,
      // phrases and sentences (with the browser's native highlight). Our
      // long-press gesture sets a real selection, which fires epubjs's
      // selectionchange-based "selected" event to show the popup.
      rendition.themes.override("-webkit-tap-highlight-color", "transparent", true);
    }

    function selectTheme(theme: "dark" | "light") {
      const rendition = renditionRef.current;
      if (!rendition) return;
      rendition.themes.register("dark", DARK_THEME);
      rendition.themes.register("light", LIGHT_THEME);
      rendition.themes.select(theme);
    }

    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;
      let destroyed = false;
      let opened = false;
      let openTimeout: ReturnType<typeof setTimeout> | undefined;
      let rendition: Rendition | null = null;
      let book: Book | null = null;

      const clearLongPress = () => {
        if (longPressTimerRef.current != null) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      };

      const clearMouseLongPress = () => {
        if (mouseLongPressTimerRef.current != null) {
          clearTimeout(mouseLongPressTimerRef.current);
          mouseLongPressTimerRef.current = null;
        }
      };

      const suppressedContextDocs = new Set<Document>();
      const preventContextMenu = (e: Event) => {
        e.preventDefault();
      };

      const findContentsForDoc = (doc: Document | null) => {
        const rend = renditionRef.current;
        const list =
          (rend as unknown as { getContents?: () => Contents[] }).getContents?.() ??
          [];
        if (doc) {
          const match = list.find((c) => c.document === doc);
          if (match) return match;
        }
        return list[0] ?? null;
      };

      const resolveWordAt = (
        target: Element | null,
        x: number,
        y: number
      ): { range: Range; contents: Contents } | null => {
        const contents = findContentsForDoc(target?.ownerDocument ?? null);
        if (!contents) return null;
        const range = wordRangeAtPoint(contents, x, y);
        if (!range) return null;
        return { range, contents };
      };

      // Suppress epubjs's "selected" event for a short window whenever *we*
      // set a selection programmatically (taps / long-press), so it doesn't
      // double-trigger a menu. Genuine drag-selections (no recent programmatic
      // set) still drive the "full" menu via onSelected.
      const markProgrammaticSelection = () => {
        suppressSelectedUntilRef.current = Date.now() + 600;
      };

      const clearTapSelection = () => {
        pendingWordRef.current = null;
        const rend = renditionRef.current;
        if (rend) clearSelectionInIframe(rend);
        callbacksRef.current.onSelectionCleared?.();
      };

      const showMenu = (
        contents: Contents,
        range: Range,
        variant: SelectionVariant
      ) => {
        setSelectionRange(contents, range);
        markProgrammaticSelection();
        pendingWordRef.current = null;
        callbacksRef.current.onSelection?.(
          buildSelectionState(contents, range, variant)
        );
      };

      const handleTap = (
        resolved: { range: Range; contents: Contents } | null
      ) => {
        if (!resolved) {
          clearTapSelection();
          return;
        }
        const pending = pendingWordRef.current;
        if (!pending) {
          // First tap: visually select the word and remember it (no menu).
          setSelectionRange(resolved.contents, resolved.range);
          markProgrammaticSelection();
          pendingWordRef.current = {
            range: resolved.range,
            contents: resolved.contents,
          };
          return;
        }
        const sameDoc =
          pending.contents.document === resolved.contents.document;
        if (sameDoc && sameRange(pending.range, resolved.range)) {
          // Second tap on the same word -> instant translate, no menu.
          showMenu(resolved.contents, resolved.range, "instantTranslate");
        } else if (sameDoc) {
          // Two different words -> select the whole range and show the menu.
          showMenu(resolved.contents, spanningRange(pending.range, resolved.range), "range");
        } else {
          // Cross-page tap -> treat as a fresh first tap.
          setSelectionRange(resolved.contents, resolved.range);
          markProgrammaticSelection();
          pendingWordRef.current = {
            range: resolved.range,
            contents: resolved.contents,
          };
        }
      };

      const handleLongPress = (
        resolved: { range: Range; contents: Contents } | null
      ) => {
        if (!resolved) return;
        showMenu(resolved.contents, resolved.range, "full");
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(12);
          } catch {}
        }
      };

      const suppressContextMenuFor = (target: Element | null) => {
        const doc = target?.ownerDocument ?? null;
        if (!doc || suppressedContextDocs.has(doc)) return;
        doc.addEventListener("contextmenu", preventContextMenu, true);
        suppressedContextDocs.add(doc);
      };

      const cancelSwipeAnim = () => {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };

      const animateScrollTo = (container: HTMLElement, target: number, duration: number) => {
        cancelSwipeAnim();
        const from = container.scrollLeft;
        if (Math.abs(target - from) < 0.5) {
          container.scrollLeft = target;
          return;
        }
        const startTime = performance.now();
        const tick = (now: number) => {
          if (!renditionRef.current) {
            rafRef.current = null;
            return;
          }
          const t = Math.min(1, (now - startTime) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          container.scrollLeft = from + (target - from) * eased;
          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            container.scrollLeft = target;
            rafRef.current = null;
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      };

      const onTouchStart = (e: Event) => {
        const te = e as TouchEvent;
        const st = swipeRef.current;
        const rend = renditionRef.current;
        if (!rend || st.navigating) return;
        if (!te.touches || te.touches.length !== 1) {
          st.active = false;
          clearLongPress();
          return;
        }
        const sc = getScroller(rend);
        if (!sc) return;
        cancelSwipeAnim();
        st.active = true;
        st.decided = false;
        st.horizontal = false;
        st.startScreenX = te.touches[0].screenX;
        st.startScreenY = te.touches[0].screenY;
        st.startScrollLeft = sc.container.scrollLeft;
        st.lastTime = performance.now();
        st.lastX = st.startScreenX;
        st.velocity = 0;
        // Remember where the finger landed so we can resolve a word on tap.
        st.tapClientX = te.touches[0].clientX;
        st.tapClientY = te.touches[0].clientY;
        st.tapTarget = (te.target as Element | null) ?? null;
        st.tapMoved = false;
        st.tapLongPressed = false;

        clearLongPress();
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          const stt = swipeRef.current;
          if (!stt.active || stt.decided) return;
          stt.tapLongPressed = true;
          stt.active = false;
          stt.decided = true;
          stt.horizontal = false;
          handleLongPress(resolveWordAt(stt.tapTarget, stt.tapClientX, stt.tapClientY));
        }, LONG_PRESS_MS);
      };

      const onTouchMove = (e: Event) => {
        const te = e as TouchEvent;
        const st = swipeRef.current;
        if (!st.active) return;
        if (!te.touches || te.touches.length !== 1) {
          st.active = false;
          st.decided = false;
          st.horizontal = false;
          clearLongPress();
          const rend = renditionRef.current;
          const sc = rend ? getScroller(rend) : null;
          if (sc) animateScrollTo(sc.container, st.startScrollLeft, SWIPE_ANIM_MS);
          return;
        }
        const rend = renditionRef.current;
        if (!rend) return;
        const sc = getScroller(rend);
        if (!sc) return;
        const cx = te.touches[0].screenX;
        const cy = te.touches[0].screenY;
        if (!st.decided) {
          const ddx = cx - st.startScreenX;
          const ddy = cy - st.startScreenY;
          if (ddx * ddx + ddy * ddy < SWIPE_DIR_LOCK * SWIPE_DIR_LOCK) return;
          // Significant movement -> not a tap; abandon any pending word so a
          // swipe can proceed cleanly.
          clearLongPress();
          st.tapMoved = true;
          if (pendingWordRef.current) clearTapSelection();
          st.decided = true;
          st.horizontal = Math.abs(ddx) >= Math.abs(ddy);
          if (!st.horizontal) {
            st.active = false;
            return;
          }
        }
        const now = performance.now();
        const dt = now - st.lastTime;
        if (dt > 0) st.velocity = (cx - st.lastX) / dt;
        st.lastTime = now;
        st.lastX = cx;
        const dx = cx - st.startScreenX;
        const target = st.startScrollLeft - dx;
        sc.container.scrollLeft = target;
      };

      const onTouchEnd = () => {
        const st = swipeRef.current;
        clearLongPress();

        if (st.tapLongPressed) {
          st.active = false;
          return; // long-press already handled selection
        }

        // A tap is a quick touch with no significant movement.
        if (!st.tapMoved) {
          st.active = false;
          handleTap(resolveWordAt(st.tapTarget, st.tapClientX, st.tapClientY));
          return;
        }

        // Otherwise it was a movement: commit a horizontal swipe, or ignore a
        // vertical drag (native scroll / selection handles).
        st.active = false;
        if (!st.horizontal) return;
        const rend = renditionRef.current;
        if (!rend) return;
        const sc = getScroller(rend);
        if (!sc) return;
        const dx = st.lastX - st.startScreenX;
        const absDx = Math.abs(dx);
        const commit =
          absDx >= sc.delta * SWIPE_TURN_RATIO ||
          Math.abs(st.velocity) >= SWIPE_FLICK_V;
        if (!commit) {
          animateScrollTo(sc.container, st.startScrollLeft, SWIPE_ANIM_MS);
          return;
        }
        if (dx < 0) {
          const target = st.startScrollLeft + sc.delta;
          if (target <= sc.maxScroll + 0.5) {
            animateScrollTo(sc.container, target, SWIPE_ANIM_MS);
          } else {
            st.navigating = true;
            void rend.next().finally(() => {
              swipeRef.current.navigating = false;
            });
          }
        } else {
          const target = st.startScrollLeft - sc.delta;
          if (target >= -0.5) {
            animateScrollTo(sc.container, target, SWIPE_ANIM_MS);
          } else {
            st.navigating = true;
            void rend.prev().finally(() => {
              swipeRef.current.navigating = false;
            });
          }
        }
      };

      const onMouseDown = (e: Event) => {
        const me = e as MouseEvent;
        const target = (me.target as Element | null) ?? null;
        const x = me.clientX;
        const y = me.clientY;
        if (me.button === 2) {
          suppressContextMenuFor(target);
          handleLongPress(resolveWordAt(target, x, y));
          return;
        }
        if (me.button !== 0) return;
        clearMouseLongPress();
        mouseTapRef.current = { x, y, target, moved: false, longClicked: false };
        mouseLongPressTimerRef.current = setTimeout(() => {
          mouseLongPressTimerRef.current = null;
          const mt = mouseTapRef.current;
          if (!mt || mt.moved) return;
          mt.longClicked = true;
          handleLongPress(resolveWordAt(mt.target, mt.x, mt.y));
        }, LONG_PRESS_MS);
      };

      const onMouseMove = (e: Event) => {
        const mt = mouseTapRef.current;
        if (!mt) return;
        const me = e as MouseEvent;
        const dx = me.clientX - mt.x;
        const dy = me.clientY - mt.y;
        if (dx * dx + dy * dy > LONG_PRESS_TOLERANCE * LONG_PRESS_TOLERANCE) {
          mt.moved = true;
          clearMouseLongPress();
        }
      };

      const onMouseUp = (e: Event) => {
        const me = e as MouseEvent;
        if (me.button !== 0) return;
        clearMouseLongPress();
        const mt = mouseTapRef.current;
        mouseTapRef.current = null;
        if (!mt || mt.longClicked) return; // long-click handled
        if (mt.moved) return; // drag-select: let native selection + onSelected handle
        handleTap(resolveWordAt(mt.target, mt.x, mt.y));
      };

      void (async () => {
        const { default: ePub } = await import("epubjs");
        if (destroyed) return;

        book = ePub(bytes);
        bookRef.current = book;
        const b = book;

        b.opened.catch((err: unknown) => {
          if (destroyed) return;
          callbacksRef.current.onError?.(
            "Could not open this EPUB. The file may be corrupted or unsupported."
          );
          console.error("epub.js open failed:", err);
        });

        b.on("openFailed", () => {
          if (destroyed) return;
          opened = true;
          callbacksRef.current.onError?.(
            "Could not open this EPUB. The file may be corrupted or unsupported."
          );
        });

        openTimeout = setTimeout(() => {
          if (destroyed || opened) return;
          callbacksRef.current.onError?.(
            "This book is taking unusually long to open. It may use resources the reader can't process."
          );
        }, 15000);
        b.opened.then(() => {
          opened = true;
        }, () => {
          opened = true;
        });

        rendition = b.renderTo(mount, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "none",
          allowScriptedContent: false,
          manager: "default",
        });
        renditionRef.current = rendition;
        const rend = rendition;

        selectTheme(settings.theme);
        applySettings();

        const saved = useReaderStore.getState().getProgress(bookId);
        const startTarget = saved?.cfi ?? undefined;

        rend
          .display(startTarget)
          .then(() => {
            if (destroyed) return;
            applySettings();
            callbacksRef.current.onReady?.();
          })
          .catch((err: unknown) => {
            callbacksRef.current.onError?.(String(err));
          });

        b.ready
          .then(() => b.locations.generate(1200))
          .then(() => {
            if (destroyed) return;
            const loc = rend.currentLocation();
            if (loc?.cfi) {
              const percentage = b.locations.percentageFromCfi(loc.cfi);
              callbacksRef.current.onRelocated?.({
                cfi: loc.cfi,
                percentage,
                atStart: false,
                atEnd: false,
              });
            }
          })
          .catch(() => {});

        const onRelocated = (location: Rendition["location"]) => {
          if (!location?.start?.cfi) return;
          const percentage = b.locations.length()
            ? b.locations.percentageFromCfi(location.start.cfi)
            : 0;
          callbacksRef.current.onRelocated?.({
            cfi: location.start.cfi,
            percentage,
            atStart: location.atStart,
            atEnd: location.atEnd,
          });
        };

        const onSelected = (cfiRange: string, contents: Contents) => {
          // Ignore selections we set ourselves (taps/long-press); those are
          // surfaced directly via onSelection. This handler only fires for
          // genuine drag-selections (e.g. desktop mouse drag), showing the
          // full menu.
          if (Date.now() < suppressSelectedUntilRef.current) return;
          try {
            const win = contents.window;
            const selection = win?.getSelection?.();
            const text = selection?.toString().trim() ?? "";
            if (!text) return;
            const range = contents.range(cfiRange);
            const context = win
              ? extractSelectionContext(range, win, text)
              : undefined;
            const r = range.getBoundingClientRect();
            const frame = win.frameElement as HTMLElement | null;
            const fr = frame?.getBoundingClientRect();
            const left = (r.left ?? 0) + (fr?.left ?? 0);
            const top = (r.top ?? 0) + (fr?.top ?? 0);
            callbacksRef.current.onSelection?.({
              cfiRange,
              text,
              rect: { left, top, width: r.width, height: r.height },
              context,
              variant: "full",
            });
          } catch {
            callbacksRef.current.onSelection?.({
              cfiRange,
              text: "",
              rect: {
                left: window.innerWidth / 2,
                top: window.innerHeight / 3,
                width: 0,
                height: 0,
              },
              variant: "full",
            });
          }
        };

        rend.on("relocated", onRelocated);
        rend.on("selected", onSelected);
        rend.on("touchstart", onTouchStart);
        rend.on("touchmove", onTouchMove);
        rend.on("touchend", onTouchEnd);
        rend.on("mousedown", onMouseDown);
        rend.on("mousemove", onMouseMove);
        rend.on("mouseup", onMouseUp);
      })();

      return () => {
        destroyed = true;
        if (openTimeout) clearTimeout(openTimeout);
        clearLongPress();
        clearMouseLongPress();
        mouseTapRef.current = null;
        pendingWordRef.current = null;
        suppressedContextDocs.forEach((doc) =>
          doc.removeEventListener("contextmenu", preventContextMenu, true)
        );
        suppressedContextDocs.clear();
        cancelSwipeAnim();
        try { rendition?.off("touchstart", onTouchStart); } catch {}
        try { rendition?.off("touchmove", onTouchMove); } catch {}
        try { rendition?.off("touchend", onTouchEnd); } catch {}
        try { rendition?.off("mousedown", onMouseDown); } catch {}
        try { rendition?.off("mousemove", onMouseMove); } catch {}
        try { rendition?.off("mouseup", onMouseUp); } catch {}
        try {
          rendition?.destroy();
        } catch {}
        try {
          book?.destroy();
        } catch {}
        renditionRef.current = null;
        bookRef.current = null;
        mount.innerHTML = "";
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookId, bytes]);

    useEffect(() => {
      selectTheme(settings.theme);
      applySettings();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.theme, settings.fontSize, settings.fontFamily, settings.lineHeight, settings.letterSpacing]);

    useImperativeHandle(ref, () => {
      const whenStarted = async (fn: (r: Rendition) => void) => {
        const r = renditionRef.current;
        if (!r) return;
        try {
          await (r.started ?? Promise.resolve());
        } catch {
          return;
        }
        if (!renditionRef.current) return;
        try {
          fn(r);
        } catch {}
      };
      return {
        next: () => whenStarted((r) => r.next()),
        prev: () => whenStarted((r) => r.prev()),
        display: async (target: string) => {
          await whenStarted((r) => {
            void r.display(target);
          });
        },
        clearSelection: () => {
          const rendition = renditionRef.current;
          const win = rendition?.getContents?.()?.window;
          win?.getSelection?.()?.removeAllRanges?.();
        },
      };
    });

    return (
      <div
        className={cn(
          "epub-view relative h-full w-full bg-background transition-colors",
          className
        )}
      >
        <div ref={mountRef} className="absolute inset-0" />
      </div>
    );
  }
);
