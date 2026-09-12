import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { CSSProperties, ReactNode, RefObject } from "react";

export interface ProductHeaderShellProps {
  headerRef?: RefObject<HTMLElement | null>;
  isScrolled?: boolean;
  start?: ReactNode;
  center?: ReactNode;
  end?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function ProductHeaderShell({
  headerRef,
  isScrolled = false,
  start,
  center,
  end,
  className,
  style,
}: ProductHeaderShellProps) {
  return (
    <header
      ref={headerRef}
      data-content-scrolled={isScrolled || undefined}
      className={cn(
        "@container relative z-20 grid h-[53px] shrink-0 items-center gap-1 bg-background px-2 min-[769px]:px-4 sm:gap-2",
        center
          ? "grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)]"
          : "grid-cols-[minmax(0,1fr)_auto]",
        className,
      )}
      style={style}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2 sm:justify-self-stretch">
        {start}
      </div>
      {center ? (
        <div className="polychat-navigation-header-center flex justify-center">{center}</div>
      ) : null}
      <div className="flex min-w-0 items-center justify-end sm:justify-self-end">{end}</div>
      <div
        aria-hidden="true"
        data-scroll-blur-edge
        className={cn(
          "pointer-events-none absolute inset-x-0 top-full h-3 bg-gradient-to-b from-foreground/[0.04] via-transparent to-transparent [mask-image:linear-gradient(to_bottom,black_0%,transparent_100%)] opacity-0 backdrop-blur-[2px] transition-opacity duration-300 ease-out [-webkit-mask-image:linear-gradient(to_bottom,black_0%,transparent_100%)] motion-reduce:transition-none dark:from-foreground/[0.12]",
          isScrolled && "opacity-70",
        )}
      />
    </header>
  );
}
