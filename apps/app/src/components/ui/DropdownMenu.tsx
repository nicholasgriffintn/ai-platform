import { type ReactNode, useEffect, useRef, useState } from "react";
import type { ButtonProps } from "./Button";
import { Button } from "./Button";

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  buttonProps?: Omit<ButtonProps, "children">;
  className?: string;
  menuClassName?: string;
}

export const DropdownMenu = ({
  trigger,
  children,
  position = "bottom",
  buttonProps,
  className = "",
  menuClassName = "",
}: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemsRef = useRef<HTMLElement[]>([]);
  const [focusIndex, setFocusIndex] = useState(-1);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const menuItems = Array.from(
      menuRef.current?.querySelectorAll('button[role="menuitem"]') || [],
    ) as HTMLElement[];
    menuItemsRef.current = menuItems;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusIndex((prev) =>
            prev < menuItemsRef.current.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusIndex((prev) =>
            prev > 0 ? prev - 1 : menuItemsRef.current.length - 1,
          );
          break;
        case "Home":
          e.preventDefault();
          setFocusIndex(0);
          break;
        case "End":
          e.preventDefault();
          setFocusIndex(menuItemsRef.current.length - 1);
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          triggerRef.current?.focus();
          break;
        case "Tab":
          setIsOpen(false);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (focusIndex >= 0 && focusIndex < menuItemsRef.current.length) {
      menuItemsRef.current[focusIndex].focus();
    }
  }, [focusIndex]);

  const positionClasses = {
    top: "bottom-full mb-2 left-0",
    bottom: "top-full mt-2 left-0",
    left: "right-full mr-2 top-0",
    right: "left-full ml-2 top-0",
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setFocusIndex(-1);
    }
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      {buttonProps ? (
        <Button
          {...buttonProps}
          onClick={toggleMenu}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          ref={triggerRef}
        >
          {trigger}
        </Button>
      ) : (
        <button
          type="button"
          onClick={toggleMenu}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleMenu();
            }
          }}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          ref={triggerRef}
          className="inline-flex items-center justify-center"
        >
          {trigger}
        </button>
      )}

      {isOpen && (
        <div
          className={`absolute ${positionClasses[position]} w-48 rounded-md shadow-lg bg-off-white dark:bg-zinc-800 ring-1 ring-black ring-opacity-5 z-20 ${menuClassName}`}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby={triggerRef.current?.id}
        >
          <div className="py-1">{children}</div>
        </div>
      )}
    </div>
  );
};

interface DropdownMenuItemProps {
  onClick?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export const DropdownMenuItem = ({
  onClick,
  icon,
  children,
  className = "",
  disabled = false,
}: DropdownMenuItemProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-off-white-highlight dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed z-10 ${className}`}
      disabled={disabled}
      role="menuitem"
      tabIndex={-1}
    >
      {icon}
      {children}
    </button>
  );
};
