"use client";

import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/hooks/useHydrated";

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

interface FullscreenApi {
  request: () => Promise<void> | void;
  exit: () => Promise<void> | void;
  element: () => Element | null;
  eventName: string;
}

/**
 * Resolve the best available fullscreen API. iPhone Safari has no Element
 * fullscreen API at all (only <video> can go fullscreen), iPad and older
 * desktop Safari expose only the webkit-prefixed variant, and everything else
 * supports the standard API. Returns null when fullscreen is unsupported so
 * callers can hide the control.
 */
function getFullscreenApi(): FullscreenApi | null {
  if (typeof document === "undefined") return null;
  const doc = document as WebkitDocument;
  const el = document.documentElement as WebkitElement;
  if (
    typeof el.requestFullscreen === "function" &&
    typeof doc.exitFullscreen === "function"
  ) {
    return {
      request: () => el.requestFullscreen(),
      exit: () => doc.exitFullscreen(),
      element: () => doc.fullscreenElement,
      eventName: "fullscreenchange",
    };
  }
  if (
    typeof el.webkitRequestFullscreen === "function" &&
    typeof doc.webkitExitFullscreen === "function"
  ) {
    return {
      request: () => el.webkitRequestFullscreen?.(),
      exit: () => doc.webkitExitFullscreen?.(),
      element: () => doc.webkitFullscreenElement ?? null,
      eventName: "webkitfullscreenchange",
    };
  }
  return null;
}

export function FullscreenToggle({ className }: { className?: string }) {
  const hydrated = useHydrated();
  const [api] = useState<FullscreenApi | null>(() => getFullscreenApi());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!api) return;
    const onChange = () => setIsFullscreen(!!api.element());
    document.addEventListener(api.eventName, onChange);
    return () => document.removeEventListener(api.eventName, onChange);
  }, [api]);

  // No API (iPhone Safari, in-browser): fullscreen is impossible via JS, so
  // hide the button instead of silently doing nothing.
  if (!hydrated || !api) return null;

  const toggle = async () => {
    try {
      if (api.element()) {
        await api.exit();
      } else {
        await api.request();
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
