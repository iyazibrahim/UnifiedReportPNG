import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline" | "destructive";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        variant === "default" &&
          "border-transparent bg-[var(--color-primary)] text-[var(--color-primary-foreground)]",
        variant === "secondary" &&
          "border-[var(--color-border)] bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]",
        variant === "outline" &&
          "border-[var(--color-border)] text-[var(--color-foreground)]",
        variant === "destructive" &&
          "border-transparent bg-[var(--color-destructive)] text-white",
        className
      )}
      {...props}
    />
  );
}
