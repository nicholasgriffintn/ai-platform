import { cn } from "./utils";

export interface SidebarBackdropProps {
  onClose: () => void;
  /** Names the dismiss control for screen readers. */
  label?: string;
  className?: string;
}

/**
 * The scrim behind a mobile sidebar drawer. It is a real button so that pointer
 * and keyboard users get the same dismiss affordance.
 */
export function SidebarBackdrop({
  onClose,
  label = "Close sidebar",
  className,
}: SidebarBackdropProps) {
  return (
    <button
      type="button"
      className={cn("fixed inset-0 z-20 cursor-default bg-black/30 md:hidden", className)}
      onClick={onClose}
      aria-label={label}
    />
  );
}
