import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-small font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-surface-hover text-text-muted",
        accent: "bg-accent text-accent-text",
        success: "bg-success/15 text-success",
        warning: "bg-warning/20 text-warning",
        danger: "bg-danger/15 text-danger",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
