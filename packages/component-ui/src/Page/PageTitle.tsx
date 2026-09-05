import { cn } from "../utils";

export function PageTitle({ title, className }: { title: string; className?: string }) {
  return (
    <h1 className={cn("text-2xl font-bold text-foreground flex items-center", className)}>
      {title}
    </h1>
  );
}
