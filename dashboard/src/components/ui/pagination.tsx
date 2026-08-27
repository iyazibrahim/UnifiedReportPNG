import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Pagination({
  className,
  ...props
}: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

export function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex flex-row items-center gap-2", className)}
      {...props}
    />
  );
}

export function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li {...props} />;
}

export function PaginationPrevious({
  className,
  disabled,
  onClick,
}: {
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("min-h-11 min-w-11 gap-1", className)}
      disabled={disabled}
      onClick={onClick}
      aria-label="Previous page"
    >
      <ChevronLeft className="size-4" />
      <span className="hidden sm:inline">Previous</span>
    </Button>
  );
}

export function PaginationNext({
  className,
  disabled,
  onClick,
}: {
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("min-h-11 min-w-11 gap-1", className)}
      disabled={disabled}
      onClick={onClick}
      aria-label="Next page"
    >
      <span className="hidden sm:inline">Next</span>
      <ChevronRight className="size-4" />
    </Button>
  );
}
