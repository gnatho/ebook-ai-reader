"use client";

import { SettingsControls } from "@/components/SettingsControls";

interface ReaderSettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function ReaderSettingsSheet({ open, onClose }: ReaderSettingsSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 animate-fade-in"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto no-scrollbar rounded-t-3xl border-t border-border bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-pop-in">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <SettingsControls />
      </div>
    </div>
  );
}
