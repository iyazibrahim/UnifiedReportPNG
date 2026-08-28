import { cn } from "@/lib/utils";
import { ONEPENANG_LOGO } from "@/lib/brand";

type Props = {
  className?: string;
  alt?: string;
};

export function OnePenangLogo({ className, alt = "OnePenang" }: Props) {
  return (
    <img
      src={ONEPENANG_LOGO}
      alt={alt}
      className={cn("object-contain", className)}
    />
  );
}
