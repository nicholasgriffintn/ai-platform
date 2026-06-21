import type { ReactNode } from "react";

export interface ComposerInlineToken {
	id: string;
	label: string;
	icon: ReactNode;
	onClear?: () => void;
}

export interface ComposerCommandAction {
	id: string;
	label: string;
	description: string;
	command: string;
	icon: ReactNode;
	isActive: boolean;
	disabled?: boolean;
	disabledReason?: string;
	keepPopoverOpen?: boolean;
	selectionText?: string;
	selectionCursorOffset?: number;
	onSelect: () => void;
}
