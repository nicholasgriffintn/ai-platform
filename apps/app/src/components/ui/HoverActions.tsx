import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Button } from "./Button";

interface HoverAction {
	/** Unique identifier */
	id: string;
	/** Icon to display */
	icon: ReactNode;
	/** Accessible label */
	label: string;
	/** Click handler */
	onClick: (e: React.MouseEvent) => void;
	/** Whether the action is disabled */
	disabled?: boolean;
	/** Custom className */
	className?: string;
}

interface HoverActionsProps {
	/** Array of action configurations */
	actions: HoverAction[];
	/** Whether actions should always be visible (e.g., on mobile) */
	alwaysVisible?: boolean;
	/** Position of the actions */
	position?: "right" | "left";
	/** Custom className */
	className?: string;
}

export function HoverActions({
	actions,
	alwaysVisible = false,
	position = "right",
	className,
}: HoverActionsProps) {
	const positionClasses = {
		right: "right-2",
		left: "left-2",
	};

	return (
		<div
			className={cn(
				"absolute",
				positionClasses[position],
				alwaysVisible
					? "opacity-100"
					: "md:opacity-0 md:group-hover:opacity-100 opacity-100",
				"transition-opacity duration-200 flex items-center space-x-1 bg-inherit",
				className,
			)}
		>
			{actions.map((action) => (
				<Button
					key={action.id}
					type="button"
					variant="icon"
					onClick={action.onClick}
					disabled={action.disabled}
					title={action.label}
					aria-label={action.label}
					icon={action.icon}
					size="icon"
					className={action.className}
				/>
			))}
		</div>
	);
}
