import type { ReactNode } from "react";

export function AccountPrompt({
	title,
	description,
	actionLabel,
	actionUnavailableReason,
	onAction,
}: {
	title: string;
	description: string;
	actionLabel: string;
	actionUnavailableReason?: string;
	onAction: () => void;
}) {
	return (
		<section className="polychat-account-prompt">
			<h2>{title}</h2>
			<p>{description}</p>
			<button
				type="button"
				disabled={Boolean(actionUnavailableReason)}
				title={actionUnavailableReason}
				onClick={onAction}
			>
				{actionLabel}
			</button>
			{actionUnavailableReason && <small>{actionUnavailableReason}</small>}
		</section>
	);
}
