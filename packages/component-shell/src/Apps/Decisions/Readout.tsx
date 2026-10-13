import { cn } from "@ngriffin_uk/polychat-component-ui";

export function Readout({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="font-mono text-2xl leading-none tracking-tight whitespace-nowrap tabular-nums">
        {value}
      </div>
      <div className="mt-1.5 truncate text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </div>
    </div>
  );
}
