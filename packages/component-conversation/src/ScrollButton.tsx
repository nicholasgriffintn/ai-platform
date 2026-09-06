import { Button } from "@ngriffin_uk/polychat-component-ui";
import { ChevronDown } from "lucide-react";

interface ScrollButtonProps {
  onClick: () => void;
}

export const ScrollButton = ({ onClick }: ScrollButtonProps) => {
  return (
    <div className="sticky bottom-6 flex justify-center px-4">
      <Button
        onClick={onClick}
        className="z-10 rounded-full border border-border bg-surface-elevated text-foreground shadow-[var(--polychat-elevated-shadow)] backdrop-blur-sm hover:bg-selection"
        aria-label="Scroll to bottom"
      >
        <span>Scroll to bottom</span>
        <ChevronDown size={16} />
      </Button>
    </div>
  );
};
