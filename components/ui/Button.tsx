import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";

// Reuses the glass/glow tokens already established elsewhere (styles/
// themes.css's "Glow/glass layer" — BuyCredits.tsx's cards, the credits
// row in LibraryFeed.tsx/Sidebar.tsx) rather than inventing a new visual
// language for buttons specifically: secondary becomes a real glass
// surface (border-glass-border + bg-glow-faint + shadow-glass-card,
// brightening on hover), primary/danger (solid fills, not translucent —
// glass doesn't read the same way on an opaque surface) get a soft
// elevation lift on hover instead. active:scale-[0.98] on every variant
// for tactile press feedback — disabled:pointer-events-none already makes
// :active unreachable while disabled, so no separate override needed there.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-small font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-text shadow-sm hover:bg-accent-hover hover:shadow-md",
        secondary:
          "border border-glass-border bg-glow-faint text-text shadow-glass-card hover:border-glass-border-hover hover:bg-glow-soft",
        ghost: "text-text hover:bg-glow-faint",
        danger: "bg-danger text-danger-text shadow-sm hover:bg-danger-hover hover:shadow-md",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, loading, disabled, children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
