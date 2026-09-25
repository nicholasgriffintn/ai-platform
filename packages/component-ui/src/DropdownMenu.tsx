import {
  createContext,
  cloneElement,
  isValidElement,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useContext,
  useId,
  useRef,
  useState,
} from "react";

import type { ButtonProps } from "./Button";
import { Button } from "./Button";

const DropdownMenuCloseContext = createContext<() => void>(() => {});

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  buttonProps?: Omit<ButtonProps, "children">;
  className?: string;
  menuClassName?: string;
}

export function DropdownMenu({
  trigger,
  children,
  position = "bottom",
  buttonProps,
  className = "",
  menuClassName = "",
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemsRef = useRef<HTMLElement[]>([]);
  const [focusIndex, setFocusIndex] = useState(-1);
  const generatedTriggerId = useId();
  const triggerId = buttonProps?.id ?? generatedTriggerId;
  const closeMenu = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) {
      // oxlint-disable-next-line react/set-state-in-effect -- synchronises focus index with external DOM menu items measured via querySelector; must reset when menu closes to preserve roving tabindex
      setFocusIndex(-1);

      return undefined;
    }

    menuItemsRef.current = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)',
      ) ?? [],
    );
    setFocusIndex(menuItemsRef.current.length > 0 ? 0 : -1);

    const menuRoot = containerRef.current;
    const ownerDocument = menuRoot?.ownerDocument;

    if (!menuRoot || !ownerDocument) {
      return undefined;
    }

    const closeOutside = (event: PointerEvent) => {
      if (!menuRoot.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    ownerDocument.addEventListener("pointerdown", closeOutside);

    return () => ownerDocument.removeEventListener("pointerdown", closeOutside);
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
    setIsOpen((open) => !open);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!isOpen) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setIsOpen(true);
      }

      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setFocusIndex((previous) =>
          previous < menuItemsRef.current.length - 1 ? previous + 1 : 0,
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setFocusIndex((previous) =>
          previous > 0 ? previous - 1 : menuItemsRef.current.length - 1,
        );
        break;
      case "Home":
        event.preventDefault();
        setFocusIndex(0);
        break;
      case "End":
        event.preventDefault();
        setFocusIndex(menuItemsRef.current.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  const handleBlur = (event: ReactFocusEvent<HTMLElement>) => {
    const container = containerRef.current;

    if (
      !container ||
      !(event.relatedTarget instanceof Node) ||
      !container.contains(event.relatedTarget)
    ) {
      setIsOpen(false);
    }
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    buttonProps?.onKeyDown?.(event);
    handleKeyDown(event);
  };

  const handleTriggerBlur = (event: ReactFocusEvent<HTMLButtonElement>) => {
    buttonProps?.onBlur?.(event);
    handleBlur(event);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {buttonProps ? (
        <Button
          {...buttonProps}
          id={triggerId}
          onClick={toggleMenu}
          onKeyDown={handleTriggerKeyDown}
          onBlur={handleTriggerBlur}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          ref={triggerRef}
        >
          {trigger}
        </Button>
      ) : (
        <button
          type="button"
          id={triggerId}
          onClick={toggleMenu}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
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
          className={`absolute bg-popover text-popover-foreground ring-border ${positionClasses[position]} z-50 w-48 rounded-md shadow-[var(--polychat-elevated-shadow)] ring-1 ${menuClassName}`}
          role="menu"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          aria-orientation="vertical"
          aria-labelledby={triggerId}
        >
          <DropdownMenuCloseContext value={closeMenu}>
            <div className="py-1">{children}</div>
          </DropdownMenuCloseContext>
        </div>
      )}
    </div>
  );
}

interface DropdownMenuItemProps {
  onClick?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  asChild?: boolean;
}

export function DropdownMenuItem({
  onClick,
  icon,
  children,
  className = "",
  disabled = false,
  asChild = false,
}: DropdownMenuItemProps) {
  const closeMenu = useContext(DropdownMenuCloseContext);
  const handleSelect = () => {
    onClick?.();
    closeMenu();
  };

  const itemClassName = `text-popover-foreground hover:bg-accent hover:text-accent-foreground z-10 flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${className}`;

  if (asChild && isValidElement<MenuItemChildProps>(children)) {
    const child = children;
    const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
      if (disabled) {
        event.preventDefault();

        return;
      }

      child.props.onClick?.(event);
      handleSelect();
    };

    return cloneElement(child, {
      className: `${itemClassName} ${child.props.className ?? ""}`,
      role: "menuitem",
      tabIndex: -1,
      "aria-disabled": disabled || undefined,
      onClick: handleClick,
      children: (
        <>
          {icon}
          {child.props.children}
        </>
      ),
    });
  }

  return (
    <button
      type="button"
      onClick={handleSelect}
      className={itemClassName}
      disabled={disabled}
      role="menuitem"
      tabIndex={-1}
    >
      {icon}
      {children}
    </button>
  );
}

interface MenuItemChildProps {
  className?: string;
  children?: ReactNode;
  role?: string;
  tabIndex?: number;
  "aria-disabled"?: boolean;
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
}
