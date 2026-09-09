import {
  createContext,
  cloneElement,
  isValidElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
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
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemsRef = useRef<HTMLElement[]>([]);
  const [focusIndex, setFocusIndex] = useState(-1);
  const generatedTriggerId = useId();
  const triggerId = buttonProps?.id ?? generatedTriggerId;

  useEffect(() => {
    if (!isOpen) {
      setFocusIndex(-1);

      return undefined;
    }

    menuItemsRef.current = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)',
      ) ?? [],
    );
    setFocusIndex(menuItemsRef.current.length > 0 ? 0 : -1);

    const menuRoot = menuRef.current;
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

  /**
   * The menu renders as a sibling of the trigger, so keys pressed while the
   * trigger still holds focus only reach a handler on their shared wrapper.
   */
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
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

  return (
    <div
      className={`relative ${className}`}
      ref={menuRef}
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      {buttonProps ? (
        <Button
          {...buttonProps}
          id={triggerId}
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
          id={triggerId}
          onClick={toggleMenu}
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
          aria-orientation="vertical"
          aria-labelledby={triggerId}
        >
          <DropdownMenuCloseContext value={() => setIsOpen(false)}>
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
