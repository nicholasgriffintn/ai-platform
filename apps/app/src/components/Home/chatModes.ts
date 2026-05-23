import { Hammer, MessageCircle, UsersRound, type LucideIcon } from "lucide-react";

export type HomeChatModeId = "chat" | "council" | "sandbox";

export interface HomeChatModeOption {
	id: HomeChatModeId;
	label: string;
	description: string;
	icon: LucideIcon;
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
	},
	{
		id: "sandbox",
		label: "Sandbox",
		description: "Run repository tasks in an isolated sandbox worker.",
		icon: Hammer,
		disabled: true,
		disabledReason: "Sandbox will move into this shared mode switcher next.",
	},
];

export function resolveHomeChatModeId(value: string | null): HomeChatModeId {
	return value === "council" ? "council" : "chat";
}

export function isSelectableHomeChatModeId(value: string): value is HomeChatModeId {
	return value === "chat" || value === "council";
}
