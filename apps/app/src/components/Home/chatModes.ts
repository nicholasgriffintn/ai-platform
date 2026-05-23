import { GitBranch, MessageCircle, UsersRound, type LucideIcon } from "lucide-react";
import type { HomeChatModeId } from "@assistant/schemas";

export type { HomeChatModeId };

export interface HomeChatModeOption {
	id: HomeChatModeId;
	label: string;
	description: string;
	icon: LucideIcon;
	exclusiveGroup?: string;
	disabled?: boolean;
	disabledReason?: string;
}

export const HOME_CHAT_MODE_OPTIONS: HomeChatModeOption[] = [
	{
		id: "chat",
		label: "Chat",
		description: "Use the standard assistant chat flow.",
		icon: MessageCircle,
	},
	{
		id: "council",
		label: "Council",
		description: "Route the prompt through selected council perspectives.",
		icon: UsersRound,
		exclusiveGroup: "chat-orchestration",
	},
	{
		id: "sandbox",
		label: "Sandbox",
		description: "Run repository tasks in an isolated sandbox worker.",
		icon: GitBranch,
		exclusiveGroup: "chat-orchestration",
	},
];

export function resolveHomeChatModeId(value: string | null): HomeChatModeId {
	return value === "council" || value === "sandbox" ? value : "chat";
}

export function isSelectableHomeChatModeId(value: string): value is HomeChatModeId {
	return value === "chat" || value === "council" || value === "sandbox";
}

export function getHomeChatModeAvailability(
	option: HomeChatModeOption,
	activeModeId: HomeChatModeId,
): { disabled: boolean; reason?: string } {
	if (option.disabled) {
		return { disabled: true, reason: option.disabledReason };
	}

	if (option.id === activeModeId || activeModeId === "chat" || !option.exclusiveGroup) {
		return { disabled: false };
	}

	const activeOption = HOME_CHAT_MODE_OPTIONS.find((candidate) => candidate.id === activeModeId);
	if (activeOption?.exclusiveGroup === option.exclusiveGroup) {
		return {
			disabled: true,
			reason: `Turn off ${activeOption.label} mode before enabling ${option.label}.`,
		};
	}

	return { disabled: false };
}
