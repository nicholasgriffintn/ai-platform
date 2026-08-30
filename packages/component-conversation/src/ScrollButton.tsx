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
        className="z-10 rounded-full bg-zinc-800/90 text-white shadow-lg backdrop-blur-sm hover:bg-zinc-700 dark:bg-zinc-700/90 dark:text-white dark:hover:bg-zinc-600"
        aria-label="Scroll to bottom"
      >
        <span>Scroll to bottom</span>
        <ChevronDown size={16} />
      </Button>
    </div>
  );
};
