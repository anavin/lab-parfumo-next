/**
 * Button — shadcn/ui style with class-variance-authority
 * Premium B2B feel — gradient primary, smooth transitions
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-primary to-brand-900 text-primary-foreground shadow-sm hover:shadow-brand hover:from-brand-800 hover:to-brand-950 hover:-translate-y-0.5",
        primary:
          "bg-gradient-to-br from-primary to-brand-900 text-primary-foreground shadow-sm hover:shadow-brand hover:from-brand-800 hover:to-brand-950 hover:-translate-y-0.5",
        destructive:
          "bg-gradient-to-br from-red-600 to-red-700 text-white shadow-sm hover:shadow-md hover:from-red-700 hover:to-red-800 hover:-translate-y-0.5",
        outline:
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground hover:border-primary/40",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 border border-border/60",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
        success:
          "bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-sm hover:from-emerald-700 hover:to-emerald-800 hover:-translate-y-0.5",
      },
      size: {
        default: "h-10 px-4 py-2",
        xs: "h-7 rounded-md px-2 text-xs",
        sm: "h-9 rounded-md px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-11 rounded-md px-6 text-base",
        xl: "h-12 rounded-lg px-8 text-base",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-xs": "size-7",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, fullWidth, asChild = false, loading, children, disabled, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
