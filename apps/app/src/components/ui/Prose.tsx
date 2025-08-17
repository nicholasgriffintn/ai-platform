import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

interface ProseProps {
  children: ReactNode;
  className?: string;
}

export function Prose({ children, className }: ProseProps) {
  return (
    <div className={cn("prose dark:prose-invert max-w-[840px]", className)}>
      {children}
    </div>
  );
}
