"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type Size = "sm" | "md" | "lg" | "xl";

const WIDTHS: Record<Size, string> = {
  sm: "26rem",
  md: "34rem",
  lg: "46rem",
  xl: "64rem",
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  size?: Size;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = "md",
  children,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      style={{ width: `min(calc(100% - 2rem), ${WIDTHS[size]})` }}
      className={cn(
        "max-h-[min(90dvh,56rem)] overflow-hidden rounded-2xl border border-border bg-surface p-0 text-foreground shadow-pop",
        "backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
      )}
    >
      <div className="flex max-h-[min(90dvh,56rem)] flex-col">
        <header className="flex flex-none items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="relative -m-1.5 flex-none rounded-lg p-1.5 text-faint-foreground transition-colors duration-150 hover:bg-surface-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {children}
        </div>

        {footer ? (
          <footer className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-muted/60 px-5 py-3.5">
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
