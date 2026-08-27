import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] shadow-lg",
          description: "text-[var(--color-muted-foreground)]",
          actionButton:
            "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]",
          cancelButton:
            "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
          error: "border-[var(--color-destructive)]/40",
        },
      }}
      {...props}
    />
  );
}
