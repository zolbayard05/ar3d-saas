import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-card border border-dashed border-border p-12 text-center",
        className,
      )}
    >
      {icon && <div className="mb-2 text-text-muted">{icon}</div>}
      <p className="text-heading font-semibold text-text">{title}</p>
      {description && <p className="max-w-sm text-small text-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
