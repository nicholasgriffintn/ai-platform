import { cn } from "../utils";

export function PageTitle({ title, className }: { title: string; className?: string }) {
  return (
    <h1 className={cn("flex items-center text-xl font-semibold text-foreground", className)}>
      {title}
    </h1>
  );
}
