import type { Contents } from "epubjs";
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
  const caret = caretRangeFromPoint(contents.document, x, y);
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
  let cfiRange = "";
  try {
    cfiRange = contents.cfiFromRange(range);
  } catch {}
  return {
    cfiRange,
    text,
    rect: { left, top, width: r.width, height: r.height },
    context,
    variant,
  };
}

/** Set a real browser selection so the native highlight shows. */
export function setSelectionRange(contents: Contents, range: Range): void {
  const sel = contents.window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
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
