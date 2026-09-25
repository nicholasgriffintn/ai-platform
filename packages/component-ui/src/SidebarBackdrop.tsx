import { cn } from "./utils";

export interface SidebarBackdropProps {
  onClose: () => void;
  label?: string;
  className?: string;
}

export function SidebarBackdrop({
  onClose,
  label = "Close sidebar",
  className,
}: SidebarBackdropProps) {
  return (
    <button
      type="button"
      className={cn(
        "fixed inset-0 z-20 cursor-default bg-[var(--polychat-overlay)] md:hidden",
        className,
      )}
      onClick={onClose}
      aria-label={label}
    />
  );
}
