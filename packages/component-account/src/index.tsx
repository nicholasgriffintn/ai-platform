import type { ReactNode } from "react";
import "./styles.css";

export interface AccountSection {
	id: string;
	label: string;
	disabledReason?: string;
	icon?: ReactNode;
}

export interface AccountNavigationProps {
	sections: AccountSection[];
	activeSectionId: string;
	ariaLabel?: string;
	onSelect: (section: AccountSection) => void;
}

export function AccountNavigation({
	sections,
	activeSectionId,
	ariaLabel = "Account settings",
	onSelect,
}: AccountNavigationProps) {
	return (
		<nav aria-label={ariaLabel}>
			<ul className="polychat-account-navigation">
				{sections.map((section) => (
					<li key={section.id}>
						<button
							type="button"
							aria-current={section.id === activeSectionId ? "page" : undefined}
							disabled={Boolean(section.disabledReason)}
							title={section.disabledReason}
							onClick={() => onSelect(section)}
						>
							{section.icon}
							{section.label}
						</button>
					</li>
				))}
			</ul>
		</nav>
	);
}

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
