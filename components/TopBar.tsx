import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function TopBar({ title, subtitle, left, right, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md",
        className
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {left}
        <div className="min-w-0">
          {title && (
            <h1 className="truncate text-[15px] font-semibold leading-tight">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="truncate text-xs text-muted">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="flex items-center gap-1">{right}</div>}
    </header>
  );
}

export function BackButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={onClick}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground/80 transition-colors hover:bg-surface-2 active:scale-95"
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
  );
}
