import type { ReactNode } from "react";

import { cn } from "../utils";

export function MediaStage({
  visual,
  transport,
  children,
  className,
}: {
  visual?: ReactNode;
  transport: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {visual ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-neutral-950 shadow-sm">
          {visual}
        </div>
      ) : null}
      {transport}
      {children}
    </div>
  );
}
