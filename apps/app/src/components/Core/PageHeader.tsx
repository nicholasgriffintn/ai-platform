import type { ReactNode } from "react";
import { Button } from "../ui";

export function PageHeader({
	children,
	actions,
}: {
	children: ReactNode;
	actions?: {
		label: string;
		onClick: () => void;
		icon: ReactNode;
		variant?: "primary" | "secondary";
		disabled?: boolean;
	}[];
}) {
	return (
		<div className="flex justify-between items-center mb-6">
			<div>{children}</div>
			{actions && (
				<div className="flex items-center gap-2">
					{actions.map((action, index) => (
						<Button
							key={index}
							onClick={action.onClick}
							variant={action.variant || "primary"}
							icon={action.icon}
							disabled={action.disabled}
						>
							{action.label}
						</Button>
					))}
				</div>
			)}
		</div>
	);
}
