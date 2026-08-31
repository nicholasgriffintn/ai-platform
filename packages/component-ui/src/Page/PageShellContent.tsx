import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../utils";

export const pageShellContentClassName = "container mx-auto p-4";

export function PageShellContent({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn(pageShellContentClassName, className)} {...props} />;
}
