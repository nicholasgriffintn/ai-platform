import { Check, ChevronRight } from "lucide-react";

import { Button } from "~/components/ui";
import { cn } from "~/lib/utils";
import { HOME_CHAT_MODE_OPTIONS, type HomeChatModeId } from "./chatModes";

interface HomeChatModeMenuProps {
	activeModeId: HomeChatModeId;
	onModeChange: (modeId: HomeChatModeId) => void;
}

export function HomeChatModeMenu({ activeModeId, onModeChange }: HomeChatModeMenuProps) {
	const modeOptions = HOME_CHAT_MODE_OPTIONS.filter((option) => option.id !== "chat");

	return (
		<div className="space-y-2">
			<div className="space-y-1">
				{modeOptions.map((option) => {
					const Icon = option.icon;
					const isActive = activeModeId === option.id;
					const nextModeId = isActive ? "chat" : option.id;

					return (
						<button
							key={option.id}
							type="button"
							disabled={option.disabled}
							onClick={() => onModeChange(nextModeId)}
							className={cn(
								"flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
								isActive
									? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
									: "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
								option.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
							)}
							title={option.disabled ? option.disabledReason : option.description}
							aria-pressed={isActive}
						>
							<Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
							<span className="min-w-0 flex-1">
								<span className="block font-medium leading-5">{option.label}</span>
								<span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
									{option.disabled ? option.disabledReason : option.description}
								</span>
							</span>
							{isActive ? (
								<span className="flex h-6 w-10 items-center justify-end rounded-full bg-blue-500 p-0.5">
									<span className="h-5 w-5 rounded-full bg-white" />
								</span>
							) : option.disabled ? (
								<ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden="true" />
							) : (
								<span className="h-6 w-10 rounded-full bg-zinc-200 p-0.5 dark:bg-zinc-700">
									<span className="block h-5 w-5 rounded-full bg-white dark:bg-zinc-300" />
								</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}

interface ActiveHomeChatModeControlProps {
	activeModeId: HomeChatModeId;
	onModeChange: (modeId: HomeChatModeId) => void;
}

export function ActiveHomeChatModeControl({
	activeModeId,
	onModeChange,
}: ActiveHomeChatModeControlProps) {
	const option = HOME_CHAT_MODE_OPTIONS.find((modeOption) => modeOption.id === activeModeId);

	if (!option || option.id === "chat") {
		return null;
	}

	const Icon = option.icon;

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onClick={() => onModeChange("chat")}
			className="h-7 gap-1.5 rounded-full bg-zinc-100 px-2 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
			title={`Disable ${option.label} mode`}
			aria-label={`Disable ${option.label} mode`}
		>
			<Icon className="h-4 w-4" aria-hidden="true" />
			<span className="hidden sm:inline">{option.label}</span>
			<Check className="h-3.5 w-3.5" aria-hidden="true" />
		</Button>
	);
}
