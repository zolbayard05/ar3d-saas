import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const spinnerVariants = cva(
  "inline-block animate-spin rounded-full border-2 border-current border-t-transparent text-text-muted",
  {
    variants: {
      size: {
        sm: "size-4",
        md: "size-6",
        lg: "size-8",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface SpinnerProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string;
}

export function Spinner({ className, size, label = "Loading", ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    />
  );
}
