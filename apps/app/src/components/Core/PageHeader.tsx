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
		isLoading?: boolean;
	}[];
}) {
	return (
		<div className="mb-6 flex items-center justify-between gap-4">
			<div className="min-w-0 flex-1">{children}</div>
			{actions && (
				<div className="flex items-center gap-2">
					{actions.map((action, index) => (
						<Button
							key={index}
							onClick={action.onClick}
							variant={action.variant || "primary"}
							icon={action.icon}
							disabled={action.disabled}
							isLoading={action.isLoading}
						>
							{action.label}
						</Button>
					))}
				</div>
			)}
		</div>
	);
}
