import type { SelectionContext } from "./types";

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "LI",
  "BLOCKQUOTE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "TD",
  "TH",
  "SECTION",
  "ARTICLE",
  "ASIDE",
  "FIGCAPTION",
  "DD",
  "DT",
]);

interface SentenceSegment {
  text: string;
  start: number;
}

function findBlock(node: Node): HTMLElement | null {
  let el: Element | null =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  while (el) {
    if (BLOCK_TAGS.has(el.tagName)) return el as HTMLElement;
    el = el.parentElement;
  }
  return null;
}

function splitSentences(text: string): SentenceSegment[] {
  const segments: SentenceSegment[] = [];
  const endRe = /[.!?…]+["'“”’’)\]]?(?:\s+|$)/g;
  let lastEnd = 0;
  let match: RegExpExecArray | null;
  while ((match = endRe.exec(text)) !== null) {
    if (endRe.lastIndex === match.index) {
      endRe.lastIndex++;
      continue;
    }
    const end = match.index + match[0].length;
    segments.push({ text: text.slice(lastEnd, end), start: lastEnd });
    lastEnd = end;
  }
  if (lastEnd < text.length) {
    segments.push({ text: text.slice(lastEnd), start: lastEnd });
  }
  return segments.length > 0
    ? segments
    : [{ text, start: 0 }];
}

function charOffset(
  block: Node,
  node: Node,
  offset: number,
  doc: Document
): number {
  try {
    const r = doc.createRange();
    r.selectNodeContents(block);
    r.setEnd(node, offset);
    return r.toString().length;
  } catch {
    return -1;
  }
}

export function extractSelectionContext(
  range: Range,
  win: Window,
  selectedText: string
): SelectionContext {
  const trimmed = selectedText.trim();
  const isWord = trimmed.length > 0 && !/\s/.test(trimmed);

  const block = findBlock(range.commonAncestorContainer);
  if (!block) {
    return { isWord, currentSentence: trimmed };
  }

  const doc = win.document;
  const startOffset = charOffset(
    block,
    range.startContainer,
    range.startOffset,
    doc
  );
  const fullText = block.textContent ?? "";
  const segments = splitSentences(fullText);

  let currentIdx = -1;
  if (startOffset >= 0) {
    currentIdx = segments.findIndex(
      (s) => startOffset >= s.start && startOffset < s.start + s.text.length
    );
  }
  if (currentIdx === -1 && trimmed) {
    currentIdx = segments.findIndex((s) => s.text.includes(trimmed));
  }

  if (currentIdx === -1) {
    return { isWord, currentSentence: trimmed };
  }

  const current = segments[currentIdx].text.trim();
  const prev = currentIdx > 0 ? segments[currentIdx - 1].text.trim() : "";
  const next = segments[currentIdx + 1]?.text.trim() ?? "";

  return {
    isWord,
    currentSentence: current || trimmed,
    prevSentence: prev || undefined,
    nextSentence: next || undefined,
  };
}
