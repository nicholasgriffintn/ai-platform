import { cn } from "./utils";

interface ProgressLineProps {
  label: string;
  className?: string;
}

export function ProgressLine({ label, className }: ProgressLineProps) {
  return (
    <span role="progressbar" aria-label={label} aria-busy="true" className={cn("block", className)}>
      <span data-motion="essential" className="polychat-motion-progress" />
    </span>
  );
}
