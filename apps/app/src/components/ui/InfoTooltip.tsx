import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui";

interface InfoTooltipProps {
  content: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  tooltipClassName?: string;
  children?: React.ReactNode;
  mode?: "click" | "hover";
}

export const InfoTooltip = ({
  content,
  className = "",
  buttonClassName = "cursor-pointer p-2 hover:bg-off-white-highlight dark:hover:bg-zinc-900 rounded-lg text-zinc-600 dark:text-zinc-400",
  tooltipClassName = "w-80 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-off-white dark:bg-zinc-900 shadow-lg",
  children,
  mode = "click",
}: InfoTooltipProps) => {
  const [showInfo, setShowInfo] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">("top");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showInfo && buttonRef.current && tooltipRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const spaceAbove = buttonRect.top;
      const spaceBelow = window.innerHeight - buttonRect.bottom;

      setPosition(spaceAbove > spaceBelow ? "top" : "bottom");
    }
  }, [showInfo]);

  useEffect(() => {
    if (mode === "click") {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          buttonRef.current &&
          !buttonRef.current.contains(event.target as Node) &&
          tooltipRef.current &&
          !tooltipRef.current.contains(event.target as Node)
        ) {
          setShowInfo(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [mode]);

  const handleMouseEnter = () => {
    if (mode === "hover") {
      setShowInfo(true);
    }
  };

  const handleMouseLeave = () => {
    if (mode === "hover") {
      setShowInfo(false);
    }
  };

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Button
        ref={buttonRef}
        type="button"
        variant="icon"
        onClick={() => mode === "click" && setShowInfo(!showInfo)}
        className={buttonClassName}
        aria-label="Show information"
        aria-expanded={showInfo}
      >
        {children ? children : <Info size={14} />}
      </Button>
      {showInfo && (
        <div
          ref={tooltipRef}
          className={`absolute ${position === "top" ? "bottom-full mb-2" : "top-full mt-2"} right-0 z-[60] ${tooltipClassName}`}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
};
