import type { Contents } from "epubjs";
import { extractSelectionContext } from "./sentenceContext";
import type { SelectionState } from "./types";

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

export function selectWordAtPoint(
  contents: Contents,
  x: number,
  y: number
): SelectionState | null {
  const doc = contents.document;
  const win = contents.window;
  const caret = caretRangeFromPoint(doc, x, y);
  if (!caret) return null;
  const wordRange = expandToWord(caret);
  if (wordRange.collapsed) return null;
  const text = wordRange.toString().trim();
  if (!text) return null;

  let cfiRange: string;
  try {
    cfiRange = contents.cfiFromRange(wordRange);
  } catch {
    return null;
  }

  const context = extractSelectionContext(wordRange, win, text);
  const r = wordRange.getBoundingClientRect();
  const frame = win.frameElement as HTMLElement | null;
  const fr = frame?.getBoundingClientRect();
  const left = (r.left ?? 0) + (fr?.left ?? 0);
  const top = (r.top ?? 0) + (fr?.top ?? 0);
  return {
    cfiRange,
    text,
    rect: { left, top, width: r.width, height: r.height },
    context,
  };
}
