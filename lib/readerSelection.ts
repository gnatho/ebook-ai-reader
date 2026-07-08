import type { Contents, Rendition } from "epubjs";
import { extractSelectionContext } from "./sentenceContext";
import type { SelectionState, SelectionVariant } from "./types";

type CaretDocument = {
  createRange: () => Range;
  caretPositionFromPoint?: (
    x: number,
    y: number
  ) => { offsetNode: Node | null; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

/**
 * Resolve a caret range at (x, y) using the browser's caret APIs. These work
 * even when the content has `user-select: none` in modern engines, but a few
 * older ones return null for non-selectable text, so `wordRangeAtPoint` falls
 * back to a geometry-based resolver when this returns nothing.
 */
function caretRangeFromPoint(
  doc: Document,
  x: number,
  y: number
): Range | null {
  const d = doc as unknown as CaretDocument;
  if (typeof d.caretPositionFromPoint === "function") {
    try {
      const pos = d.caretPositionFromPoint(x, y);
      if (pos && pos.offsetNode) {
        const range = d.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
        return range;
      }
    } catch {}
  }
  if (typeof d.caretRangeFromPoint === "function") {
    try {
      return d.caretRangeFromPoint(x, y);
    } catch {}
  }
  return null;
}

/**
 * Geometry fallback used when caret APIs return null (e.g. some engines refuse
 * to resolve a caret on `user-select: none` content). Walks the text nodes
 * under the hit element and finds the character whose rect is closest to (x,y).
 */
function caretRangeFromPointFallback(
  doc: Document,
  x: number,
  y: number
): Range | null {
  const el = doc.elementFromPoint(x, y) as Element | null;
  if (!el) return null;
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return (node.textContent ?? "").trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const probe = doc.createRange();
  let best: { node: Text; offset: number; dist: number } | null = null;
  let tn: Node | null;
  while ((tn = walker.nextNode())) {
    const text = tn as Text;
    const len = text.length;
    if (len === 0) continue;
    // Quick reject: skip text nodes whose bounding box is far from the point.
    probe.selectNodeContents(text);
    const nb = probe.getBoundingClientRect();
    if (
      x < nb.left - 2 ||
      x > nb.right + 2 ||
      y < nb.top - 2 ||
      y > nb.bottom + 2
    ) {
      continue;
    }
    for (let i = 0; i < len; i++) {
      probe.setStart(text, i);
      probe.setEnd(text, i + 1);
      const rect = probe.getBoundingClientRect();
      if (!rect.width && !rect.height) continue;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = (cx - x) ** 2 + (cy - y) ** 2;
      if (!best || dist < best.dist) best = { node: text, offset: i, dist };
    }
  }
  try {
    probe.detach();
  } catch {}
  if (!best) return null;
  const r = doc.createRange();
  r.setStart(best.node, best.offset);
  r.setEnd(best.node, best.offset);
  return r;
}

const WORD_CHAR = /[\p{L}\p{N}_'-]/u;

function expandToWord(range: Range): Range {
  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return range;
  const text = node.textContent ?? "";
  let start = range.startOffset;
  let end = range.endOffset;
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
  while (end < text.length && WORD_CHAR.test(text[end])) end++;
  if (start >= end) return range;
  const r = range.cloneRange();
  try {
    r.setStart(node, start);
    r.setEnd(node, end);
  } catch {
    return range;
  }
  return r;
}

/** Resolve the whole word under (x, y) without modifying the selection. */
export function wordRangeAtPoint(
  contents: Contents,
  x: number,
  y: number
): Range | null {
  let caret = caretRangeFromPoint(contents.document, x, y);
  if (!caret) caret = caretRangeFromPointFallback(contents.document, x, y);
  if (!caret) return null;
  const wordRange = expandToWord(caret);
  if (wordRange.collapsed) return null;
  if (!wordRange.toString().trim()) return null;
  return wordRange;
}

/** Build a SelectionState (cfi/text/rect/context) from a real DOM range. */
export function buildSelectionState(
  contents: Contents,
  range: Range,
  variant?: SelectionVariant
): SelectionState {
  const win = contents.window;
  const text = range.toString().trim();
  const context = extractSelectionContext(range, win, text);
  const r = range.getBoundingClientRect();
  const frame = win.frameElement as HTMLElement | null;
  const fr = frame?.getBoundingClientRect();
  const left = (r.left ?? 0) + (fr?.left ?? 0);
  const top = (r.top ?? 0) + (fr?.top ?? 0);
  return {
    cfiRange: cfiFromRangeSafe(contents, range),
    text,
    rect: { left, top, width: r.width, height: r.height },
    context,
    variant,
  };
}

export function cfiFromRangeSafe(contents: Contents, range: Range): string {
  try {
    return contents.cfiFromRange(range) ?? "";
  } catch {
    return "";
  }
}

export function rangeFromCfiSafe(
  contents: Contents,
  cfi: string
): Range | null {
  if (!cfi) return null;
  try {
    return contents.range(cfi);
  } catch {
    return null;
  }
}

export function sameRange(a: Range, b: Range): boolean {
  return (
    a.startContainer === b.startContainer &&
    a.startOffset === b.startOffset &&
    a.endContainer === b.endContainer &&
    a.endOffset === b.endOffset
  );
}

/** Build a range covering both a and b (in document order). */
export function spanningRange(a: Range, b: Range): Range {
  try {
    const ord = a.compareBoundaryPoints(Range.START_TO_START, b);
    const first = ord <= 0 ? a : b;
    const second = ord <= 0 ? b : a;
    const r = a.cloneRange();
    r.setStart(first.startContainer, first.startOffset);
    r.setEnd(second.endContainer, second.endOffset);
    return r;
  } catch {
    return a;
  }
}

/* ------------------------------------------------------------------ */
/* Custom highlighting (no native selection)                          */
/* ------------------------------------------------------------------ */

const HL_NAME = "reader-selection";
const HL_CLASS = "reader-hl";

const SELECTION_CSS_KEY = "kilo-reader-selection";

/**
 * CSS injected into each epub iframe. Native selection is disabled entirely
 * (this is what stops the mobile selection handles / magnifier / callouts
 * from interfering with our tap model) and a custom highlight is drawn either
 * via the CSS Custom Highlight API (`::highlight`) or the `.reader-hl` span
 * fallback.
 */
const SELECTION_CSS = `
:root, html, body, body * {
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  user-select: none !important;
  -webkit-touch-callout: none !important;
}
::selection { background: transparent !important; color: inherit !important; }
::highlight(${HL_NAME}) {
  background-color: rgba(99, 102, 241, 0.32);
}
.${HL_CLASS} {
  background-color: rgba(99, 102, 241, 0.32);
  border-radius: 2px;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
`;

type MaybeHighlightWindow = {
  Highlight?: new (...ranges: Range[]) => unknown;
  CSS?: {
    highlights?: {
      set: (name: string, highlight: unknown) => void;
      delete: (name: string) => boolean;
    };
  };
};

interface TextSlice {
  node: Text;
  start: number;
  end: number;
}

function textNodesInRange(doc: Document, range: Range): TextSlice[] {
  const root = range.commonAncestorContainer;
  const walkerRoot =
    root.nodeType === Node.ELEMENT_NODE ? root : root.parentElement ?? root;
  const walker = doc.createTreeWalker(walkerRoot, NodeFilter.SHOW_TEXT);
  const out: TextSlice[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const text = n as Text;
    if (text.length === 0) continue;
    if (!range.intersectsNode(text)) continue;
    let start = 0;
    let end = text.length;
    if (text === range.startContainer) start = range.startOffset;
    if (text === range.endContainer) end = range.endOffset;
    if (start >= end) continue;
    out.push({ node: text, start, end });
  }
  return out;
}

/** Highlight a range without disturbing the surrounding DOM when possible. */
export function applyHighlight(contents: Contents, range: Range): void {
  const win = contents.window as unknown as MaybeHighlightWindow | undefined;
  try {
    const highlights = win?.CSS?.highlights;
    const HighlightCtor = win?.Highlight;
    if (highlights && HighlightCtor) {
      highlights.delete(HL_NAME);
      highlights.set(HL_NAME, new HighlightCtor(range));
      return;
    }
  } catch {}
  // Fallback: wrap the selected text in highlight spans.
  wrapRange(contents.document, range);
}

export function clearHighlight(contents: Contents): void {
  const win = contents.window as unknown as MaybeHighlightWindow | undefined;
  try {
    win?.CSS?.highlights?.delete(HL_NAME);
  } catch {}
  unwrapSpans(contents.document);
  try {
    contents.window?.getSelection?.()?.removeAllRanges?.();
  } catch {}
}

/** Clear highlights across every contents view of the rendition. */
export function clearHighlightsInRendition(rend: Rendition | null): void {
  if (!rend) return;
  const list = (
    rend as unknown as { getContents?: () => Contents[] | Contents }
  ).getContents?.();
  const arr = Array.isArray(list) ? list : list ? [list] : [];
  for (const c of arr) {
    if (c) clearHighlight(c as Contents);
  }
}

function wrapRange(doc: Document, range: Range): void {
  for (const { node, start, end } of textNodesInRange(doc, range)) {
    if (end - start <= 0) continue;
    // Slice the text node so `toWrap` holds exactly the [start, end) portion.
    // Split the right side first, then the left side, leaving the middle piece.
    let toWrap = node;
    if (end < toWrap.length) toWrap.splitText(end);
    if (start > 0) toWrap = toWrap.splitText(start);
    const wrapper = doc.createElement("span");
    wrapper.className = HL_CLASS;
    toWrap.parentNode?.insertBefore(wrapper, toWrap);
    wrapper.appendChild(toWrap);
  }
}

function unwrapSpans(doc: Document): void {
  const spans = Array.from(doc.querySelectorAll("." + HL_CLASS));
  for (const span of spans) {
    const parent = span.parentNode;
    if (!parent) continue;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
    parent.normalize();
  }
}

/** Inject (idempotently) the selection CSS into every epub iframe. */
export function injectSelectionStyles(rend: Rendition | null): void {
  if (!rend) return;
  const list = (
    rend as unknown as { getContents?: () => Contents[] | Contents }
  ).getContents?.();
  const arr = Array.isArray(list) ? list : list ? [list] : [];
  for (const c of arr) {
    const contents = c as Contents | undefined;
    if (!contents?.document) continue;
    try {
      contents.addStylesheetCss(SELECTION_CSS, SELECTION_CSS_KEY);
    } catch {}
  }
}
