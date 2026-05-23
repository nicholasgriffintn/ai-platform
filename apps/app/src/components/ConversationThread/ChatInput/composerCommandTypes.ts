import type { ReactNode } from "react";

export interface ComposerCommandAction {
	id: string;
	label: string;
	description: string;
	command: string;
	icon: ReactNode;
	isActive: boolean;
	disabled?: boolean;
	disabledReason?: string;
	onSelect: () => void;
}
