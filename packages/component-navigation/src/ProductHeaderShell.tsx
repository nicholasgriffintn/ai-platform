import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode, RefObject } from "react";

export interface ProductHeaderShellProps {
  headerRef?: RefObject<HTMLElement | null>;
  isScrolled?: boolean;
  start?: ReactNode;
  center?: ReactNode;
  end?: ReactNode;
}

export function ProductHeaderShell({
  headerRef,
  isScrolled = false,
  start,
  center,
  end,
}: ProductHeaderShellProps) {
  return (
    <header
      ref={headerRef}
      data-content-scrolled={isScrolled || undefined}
      className="@container relative z-20 grid h-[53px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] items-center gap-1 bg-off-white px-2 dark:bg-zinc-900 min-[769px]:px-4 sm:gap-2"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:justify-self-stretch sm:gap-2">
        {start}
      </div>
      <div className="polychat-navigation-header-center flex justify-center">{center}</div>
      <div className="flex min-w-0 items-center justify-end sm:justify-self-end">{end}</div>
      <div
        aria-hidden="true"
        data-scroll-blur-edge
        className={cn(
          "pointer-events-none absolute inset-x-0 top-full h-3 bg-gradient-to-b from-zinc-950/[0.035] via-transparent to-transparent opacity-0 backdrop-blur-[2px] transition-opacity duration-300 ease-out [-webkit-mask-image:linear-gradient(to_bottom,black_0%,transparent_100%)] [mask-image:linear-gradient(to_bottom,black_0%,transparent_100%)] motion-reduce:transition-none dark:from-black/15",
          isScrolled && "opacity-70",
        )}
      />
    </header>
  );
}
