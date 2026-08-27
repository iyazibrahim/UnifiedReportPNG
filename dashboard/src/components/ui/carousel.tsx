import * as React from "react";
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CarouselApi = UseEmblaCarouselType[1];

type CarouselProps = {
  opts?: Parameters<typeof useEmblaCarousel>[0];
  setApi?: (api: CarouselApi) => void;
};

const CarouselContext = React.createContext<{
  api: CarouselApi | undefined;
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  selectedIndex: number;
  slideCount: number;
} | null>(null);

function useCarousel() {
  const ctx = React.useContext(CarouselContext);
  if (!ctx) throw new Error("useCarousel must be used within <Carousel />");
  return ctx;
}

export function Carousel({
  opts,
  setApi,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & CarouselProps) {
  const [carouselRef, api] = useEmblaCarousel({ ...opts, loop: false });
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [slideCount, setSlideCount] = React.useState(0);

  const onSelect = React.useCallback((a: CarouselApi) => {
    if (!a) return;
    setCanScrollPrev(a.canScrollPrev());
    setCanScrollNext(a.canScrollNext());
    setSelectedIndex(a.selectedScrollSnap());
    setSlideCount(a.scrollSnapList().length);
  }, []);

  React.useEffect(() => {
    if (!api) return;
    setApi?.(api);
    onSelect(api);
    api.on("reInit", onSelect);
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect, setApi]);

  const scrollPrev = React.useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = React.useCallback(() => api?.scrollNext(), [api]);

  return (
    <CarouselContext.Provider
      value={{
        api,
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
        selectedIndex,
        slideCount,
      }}
    >
      <div
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        {...props}
      >
        <div ref={carouselRef} className="overflow-hidden rounded-md">
          {children}
        </div>
      </div>
    </CarouselContext.Provider>
  );
}

export function CarouselContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex", className)} {...props} />
  );
}

export function CarouselItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      className={cn("min-w-0 shrink-0 grow-0 basis-full", className)}
      {...props}
    />
  );
}

export function CarouselPrevious({ className }: { className?: string }) {
  const { scrollPrev, canScrollPrev } = useCarousel();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "absolute left-2 top-1/2 z-10 size-11 -translate-y-1/2 rounded-full p-0",
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      aria-label="Previous photo"
    >
      <ArrowLeft className="size-4" />
    </Button>
  );
}

export function CarouselNext({ className }: { className?: string }) {
  const { scrollNext, canScrollNext } = useCarousel();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "absolute right-2 top-1/2 z-10 size-11 -translate-y-1/2 rounded-full p-0",
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      aria-label="Next photo"
    >
      <ArrowRight className="size-4" />
    </Button>
  );
}

export function CarouselDots({ className }: { className?: string }) {
  const { api, selectedIndex, slideCount } = useCarousel();
  if (slideCount <= 1) return null;
  return (
    <div
      className={cn("mt-3 flex justify-center gap-2", className)}
      role="tablist"
      aria-label="Photo slides"
    >
      {Array.from({ length: slideCount }).map((_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === selectedIndex}
          aria-label={`Photo ${i + 1}`}
          className={cn(
            "size-2.5 rounded-full transition-colors",
            i === selectedIndex
              ? "bg-[var(--color-primary)]"
              : "bg-[var(--color-border)]"
          )}
          onClick={() => api?.scrollTo(i)}
        />
      ))}
    </div>
  );
}
