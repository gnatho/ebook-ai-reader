export type Theme = "dark" | "light";

export type TargetLanguage = "en-en" | "en-zh";

export type FontFamilyKey = "sans" | "serif" | "mono";

export interface FontOption {
  key: FontFamilyKey;
  label: string;
  stack: string;
}

export interface Settings {
  fontSize: number;
  fontFamily: FontFamilyKey;
  theme: Theme;
  targetLanguage: TargetLanguage;
  lineHeight: number;
  letterSpacing: number;
}

export type BookFormat = "epub" | "txt";

export interface BookMeta {
  id: string;
  title: string;
  author?: string;
  format: BookFormat;
  cover?: string;
  addedAt: number;
  size: number;
}

export interface ReadingProgress {
  bookId: string;
  cfi: string;
  percentage: number;
  locationLabel?: string;
  updatedAt: number;
}

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";

export interface Highlight {
  id: string;
  bookId: string;
  cfiRange: string;
  text: string;
  color: HighlightColor;
  note?: string;
  createdAt: number;
}

export interface SavedQuote {
  id: string;
  bookId: string;
  text: string;
  cfiRange: string;
  createdAt: number;
}

export interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SelectionState {
  cfiRange: string;
  text: string;
  rect: SelectionRect;
}

export type LlmAction = "simplify" | "translate" | "define";

export interface LlmRequest {
  action: LlmAction;
  text: string;
  sentence?: string;
  targetLanguage: TargetLanguage;
}

export interface LlmResponse {
  result: string;
  example?: string;
}
