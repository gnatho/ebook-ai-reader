"use client";

import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";

export function FullscreenToggle({ className }: { className?: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen may be blocked or unsupported; ignore.
    }
  };

  return (
    <button
      type="button"
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      onClick={toggle}
      className={cn(
        "relative grid h-9 w-9 place-items-center rounded-full text-foreground/80 transition-colors hover:bg-surface-2 active:scale-95",
        className
      )}
    >
      {isFullscreen ? (
        <Minimize className="h-5 w-5" />
      ) : (
        <Maximize className="h-5 w-5" />
      )}
    </button>
  );
}
