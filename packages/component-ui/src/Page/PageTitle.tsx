import { cn } from "../utils";

export function PageTitle({ title, className }: { title: string; className?: string }) {
  return (
    <h1 className={cn("text-foreground flex items-center text-xl font-semibold", className)}>
      {title}
    </h1>
  );
}
