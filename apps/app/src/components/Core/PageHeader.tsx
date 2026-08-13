import type { ReactNode } from "react";
import { Button } from "../ui";

export interface PageHeaderAction {
	label: string;
	onClick: () => void;
	icon: ReactNode;
	variant?: "primary" | "secondary";
	disabled?: boolean;
	isLoading?: boolean;
}

export function PageHeaderActions({ actions }: { actions: PageHeaderAction[] }) {
	return (
		<div className="flex shrink-0 items-center gap-1 sm:gap-2">
			{actions.map((action, index) => (
				<Button
					key={`${action.label}-${index}`}
					onClick={action.onClick}
					variant={action.variant || "primary"}
					size="sm"
					className="h-8 w-8 shrink-0 px-0 sm:w-auto sm:px-3"
					aria-label={action.label}
					title={action.label}
					disabled={action.disabled}
					isLoading={action.isLoading}
				>
					{action.isLoading ? (
						<span className="hidden sm:inline">{action.label}</span>
					) : (
						<span className="flex items-center gap-2">
							{action.icon}
							<span className="hidden sm:inline">{action.label}</span>
						</span>
					)}
				</Button>
			))}
		</div>
	);
}

export function PageHeader({
	children,
	actions,
}: {
	children: ReactNode;
	actions?: PageHeaderAction[];
}) {
	return (
		<div className="mb-6 flex items-center justify-between gap-4">
			<div className="min-w-0 flex-1">{children}</div>
			{actions && <PageHeaderActions actions={actions} />}
		</div>
	);
}
