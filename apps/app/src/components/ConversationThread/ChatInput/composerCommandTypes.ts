import type { ProjectCapabilityKind } from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";

export interface ComposerAssistantActionCapability {
	kind: ProjectCapabilityKind;
	capabilityId: string;
}

export interface ComposerActionCatalogConfig {
	includeAgents?: boolean;
	includeTools?: boolean;
	projectId?: string;
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
