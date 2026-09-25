import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export function RegistryPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 rounded-lg border border-border p-4", className)}>{children}</div>
  );
}
