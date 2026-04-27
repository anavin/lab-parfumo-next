import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...rest }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-lg border border-slate-300 bg-white px-3",
          "text-sm text-slate-800 placeholder:text-slate-400",
          "focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100",
          "disabled:bg-slate-50 disabled:text-slate-400",
          "transition-colors",
          className,
        )}
        {...rest}
      />
    );
  },
);
Input.displayName = "Input";
