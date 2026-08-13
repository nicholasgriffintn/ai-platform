import { BriefcaseBusiness, MessageCircle } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import "./styles.css";

export type ProductMode = "chat" | "work";

export interface ProductModeSwitchProps {
	activeMode: ProductMode;
	className?: string;
	onSelect: (mode: ProductMode) => void;
	renderControl?: (control: ProductModeControl) => ReactNode;
}

export interface ProductModeControl {
	active: boolean;
	className: string;
	icon: ReactNode;
	label: string;
	mode: ProductMode;
	onSelect: () => void;
}

export function ProductModeSwitch({
	activeMode,
	className,
	onSelect,
	renderControl,
}: ProductModeSwitchProps) {
	const controls: Array<{ icon: ReactNode; label: string; mode: ProductMode }> = [
		{ icon: <MessageCircle size={15} aria-hidden="true" />, label: "Chat", mode: "chat" },
		{ icon: <BriefcaseBusiness size={15} aria-hidden="true" />, label: "Work", mode: "work" },
	];

	return (
		<div
			className={["polychat-navigation-mode-switch", className].filter(Boolean).join(" ")}
			role="group"
			aria-label="Product mode"
		>
			{controls.map(({ icon, label, mode }) => {
				const control: ProductModeControl = {
					active: activeMode === mode,
					className: "polychat-navigation-mode-control",
					icon,
					label,
					mode,
					onSelect: () => onSelect(mode),
				};
				return renderControl ? (
					<Fragment key={mode}>{renderControl(control)}</Fragment>
				) : (
					<button
						key={mode}
						type="button"
						className={control.className}
						aria-pressed={control.active}
						onClick={control.onSelect}
					>
						{icon}
						<span className="polychat-navigation-mode-label">{label}</span>
					</button>
				);
			})}
		</div>
	);
}

export interface NavigationItem {
	id: string;
	label: string;
	disabledReason?: string;
	icon?: ReactNode;
}

export function NavigationList({
	items,
	activeItemId,
	ariaLabel,
	onSelect,
}: {
	items: NavigationItem[];
	activeItemId?: string;
	ariaLabel: string;
	onSelect: (item: NavigationItem) => void;
}) {
	return (
		<nav aria-label={ariaLabel}>
			<ul className="polychat-navigation-list">
				{items.map((item) => (
					<li key={item.id}>
						<button
							type="button"
							aria-current={item.id === activeItemId ? "page" : undefined}
							disabled={Boolean(item.disabledReason)}
							title={item.disabledReason}
							onClick={() => onSelect(item)}
						>
							{item.icon}
							{item.label}
						</button>
					</li>
				))}
			</ul>
		</nav>
	);
}
