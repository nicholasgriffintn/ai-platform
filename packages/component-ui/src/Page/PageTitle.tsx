import { cn } from "../utils";

export function PageTitle({
  title,
  className,
  as = "h1",
}: {
  title: string;
  className?: string;
  as?: "h1" | "span";
}) {
  const Element = as;

  return (
    <Element className={cn("flex items-center text-xl font-semibold text-foreground", className)}>
      {title}
    </Element>
  );
}
