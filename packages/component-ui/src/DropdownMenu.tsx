import {
	cloneElement,
	isValidElement,
	type MouseEvent as ReactMouseEvent,
	type ReactElement,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";

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

	useEffect(() => {
		if (!isOpen) return;
		menuItemsRef.current = Array.from(
			menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
		);

		const menuRoot = menuRef.current;
		const ownerDocument = menuRoot?.ownerDocument;
		if (!menuRoot || !ownerDocument) return;

		const closeOutside = (event: PointerEvent) => {
			if (!menuRoot.contains(event.target as Node)) setIsOpen(false);
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
		if (!isOpen) setFocusIndex(-1);
	};

	return (
		<div
			className={`relative ${className}`}
			ref={menuRef}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
			}}
		>
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
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
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
					className={`absolute ${positionClasses[position]} z-50 w-48 rounded-md bg-off-white shadow-lg ring-1 ring-black/5 dark:bg-zinc-800 ${menuClassName}`}
					role="menu"
					aria-orientation="vertical"
					aria-labelledby={triggerRef.current?.id}
					onKeyDown={(event) => {
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
					}}
				>
					<div className="py-1">{children}</div>
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
	const itemClassName = `z-10 flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-off-white-highlight disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-700 ${className}`;

	if (asChild && isValidElement<MenuItemChildProps>(children)) {
		const child = children as ReactElement<MenuItemChildProps>;
		const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
			if (disabled) {
				event.preventDefault();
				return;
			}
			child.props.onClick?.(event);
			onClick?.();
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
			onClick={onClick}
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
