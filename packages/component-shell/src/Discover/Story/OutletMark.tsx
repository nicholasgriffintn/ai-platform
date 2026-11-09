import { Favicon } from "@ngriffin_uk/polychat-component-content";
import { cn } from "@ngriffin_uk/polychat-component-ui";

export function OutletMark({
  name,
  url,
  className,
}: {
  name: string;
  url: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-selection font-display text-sm font-medium text-foreground uppercase",
        className,
      )}
    >
      {name.slice(0, 1)}
      {url ? (
        <Favicon url={url} className="absolute inset-0 size-full bg-selection p-[18%]" />
      ) : null}
    </span>
  );
}
