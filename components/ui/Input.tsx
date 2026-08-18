import { type InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-small font-medium text-text">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-10 rounded-md border border-border bg-surface px-3 text-body text-text placeholder:text-text-muted",
            "focus-visible:border-accent",
            error && "border-danger",
            className,
          )}
          {...props}
        />
        {error && <p className="text-small text-danger">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";
