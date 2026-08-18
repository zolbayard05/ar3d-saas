"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Wraps the native <dialog> element for built-in modal semantics (focus
 * trap, Escape-to-close, ::backdrop) instead of hand-rolling a portal.
 */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="dialog-title"
      className={cn(
        "rounded-card border border-border-subtle bg-surface p-6 text-text shadow-lg backdrop:bg-text/40",
        className,
      )}
    >
      <h2 id="dialog-title" className="text-heading font-semibold">
        {title}
      </h2>
      {description && <p className="mt-1 text-small text-text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </dialog>
  );
}
