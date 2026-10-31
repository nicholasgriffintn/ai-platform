import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import type { HorizontalScrollState } from "@ngriffin_uk/polychat-utility-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const DISCOVER_CAROUSEL_TRACK =
  "snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function DiscoverCarouselControls({
  scroller,
  label,
  className,
}: {
  scroller: HorizontalScrollState;
  label: string;
  className?: string;
}) {
  if (!scroller.overflowing) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="outline"
        size="xs"
        className="rounded-full"
        aria-label={`Previous in ${label}`}
        disabled={!scroller.canScrollStart}
        icon={<ChevronLeft size={14} aria-hidden />}
        onClick={() => scroller.scrollByPage(-1)}
      />
      <Button
        variant="outline"
        size="xs"
        className="rounded-full"
        aria-label={`Next in ${label}`}
        disabled={!scroller.canScrollEnd}
        icon={<ChevronRight size={14} aria-hidden />}
        onClick={() => scroller.scrollByPage(1)}
      />
    </div>
  );
}

export function DiscoverCarouselFade({ scroller }: { scroller: HorizontalScrollState }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-background to-transparent transition-opacity duration-200",
        !scroller.canScrollEnd && "opacity-0",
      )}
    />
  );
}
