import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Info, CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm flex items-start gap-3 [&>svg]:size-5 [&>svg]:flex-shrink-0 [&>svg]:mt-0.5",
  {
    variants: {
      tone: {
        default: "bg-background text-foreground border-border",
        info: "bg-info/5 text-info border-info/20 [&>svg]:text-info",
        success: "bg-success/5 text-success border-success/20 [&>svg]:text-success",
        warning: "bg-warning/5 text-warning border-warning/20 [&>svg]:text-warning",
        danger: "bg-destructive/5 text-destructive border-destructive/20 [&>svg]:text-destructive",
        destructive: "bg-destructive/5 text-destructive border-destructive/20 [&>svg]:text-destructive",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

const TONE_ICON = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  destructive: XCircle,
} as const;

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  hideIcon?: boolean;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, tone = "default", hideIcon, children, ...props }, ref) => {
    const Icon = TONE_ICON[tone ?? "default"];
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ tone }), "animate-fade-in-up", className)}
        {...props}
      >
        {!hideIcon && Icon && <Icon />}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    );
  },
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight mb-1", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
