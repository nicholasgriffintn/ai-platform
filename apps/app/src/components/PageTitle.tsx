import { cn } from "~/lib/utils";

export function PageTitle({
  title,
  className,
}: { title: string; className?: string }) {
  return (
    <h1
      className={cn(
        "text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center",
        className,
      )}
    >
      {title}
    </h1>
  );
}
