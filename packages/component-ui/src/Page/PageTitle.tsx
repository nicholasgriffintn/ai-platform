import { cn } from "../utils";

export function PageTitle({ title, className }: { title: string; className?: string }) {
  return (
    <h1
      className={cn(
        "text-foreground font-display flex items-center text-2xl font-medium tracking-tight",
        className,
      )}
    >
      {title}
    </h1>
  );
}
