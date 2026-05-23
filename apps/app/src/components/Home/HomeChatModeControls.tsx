import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import {
	HOME_CHAT_MODE_OPTIONS,
	getHomeChatModeAvailability,
	type HomeChatModeId,
} from "./chatModes";

interface HomeChatModeMenuProps {
	activeModeId: HomeChatModeId;
	activeModeControls?: ReactNode;
	onModeChange: (modeId: HomeChatModeId) => void;
}

export function HomeChatModeMenu({
	activeModeControls,
	activeModeId,
	onModeChange,
}: HomeChatModeMenuProps) {
	const modeOptions = HOME_CHAT_MODE_OPTIONS.filter((option) => option.id !== "chat");

	return (
		<div className="space-y-2">
			<div className="space-y-1">
				{modeOptions.map((option) => {
					const Icon = option.icon;
					const isActive = activeModeId === option.id;
					const nextModeId = isActive ? "chat" : option.id;
					const availability = getHomeChatModeAvailability(option, activeModeId);

					return (
						<div
							key={option.id}
							className={cn(
								isActive &&
									"rounded-lg bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50",
							)}
						>
							<button
								type="button"
								disabled={availability.disabled}
								onClick={() => onModeChange(nextModeId)}
								className={cn(
									"flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
									isActive
										? "text-zinc-950 dark:text-zinc-50"
										: "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
									availability.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
								)}
								title={availability.disabled ? availability.reason : option.description}
								aria-pressed={isActive}
							>
								<Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
								<span className="min-w-0 flex-1">
									<span className="block font-medium leading-5">{option.label}</span>
									<span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
										{availability.disabled ? availability.reason : option.description}
									</span>
								</span>
								{isActive ? (
									<span className="flex h-6 w-10 items-center justify-end rounded-full bg-blue-500 p-0.5">
										<span className="h-5 w-5 rounded-full bg-white" />
									</span>
								) : availability.disabled ? (
									<ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden="true" />
								) : (
									<span className="h-6 w-10 rounded-full bg-zinc-200 p-0.5 dark:bg-zinc-700">
										<span className="block h-5 w-5 rounded-full bg-white dark:bg-zinc-300" />
									</span>
								)}
							</button>
							{isActive && activeModeControls && (
								<div className="border-t border-zinc-200/80 p-2 dark:border-zinc-700/80">
									{activeModeControls}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

interface HomeChatModeTriggerProps {
	activeModeId: HomeChatModeId;
}

export function HomeChatModeTrigger({ activeModeId }: HomeChatModeTriggerProps) {
	const option = HOME_CHAT_MODE_OPTIONS.find((modeOption) => modeOption.id === activeModeId);

	if (!option) {
		return null;
	}

	const Icon = option.icon;

	return <Icon className="h-4 w-4" aria-hidden="true" />;
}
