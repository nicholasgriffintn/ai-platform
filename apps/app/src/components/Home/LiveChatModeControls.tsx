import { Check, Loader2, Mic, RadioTower, Square, Video } from "lucide-react";

import type { RealtimeLiveStatus } from "~/hooks/useRealtimeLiveSession";
import {
	REALTIME_LIVE_PROVIDER_OPTIONS,
	type RealtimeLiveProviderId,
} from "~/lib/realtime/live-providers";
import { cn } from "~/lib/utils";

interface LiveChatModeControlsProps {
	error?: string | null;
	lastEvent: string;
	lastTranscript?: string | null;
	onProviderChange: (provider: RealtimeLiveProviderId) => void;
	onStart: () => void;
	onStop: () => void;
	provider: RealtimeLiveProviderId;
	showHeader?: boolean;
	status: RealtimeLiveStatus;
}

function ProviderIcon({ provider }: { provider: RealtimeLiveProviderId }) {
	if (provider === "google-ai-studio") {
		return <Video className="h-4 w-4" aria-hidden="true" />;
	}
	if (provider === "mistral") {
		return <Mic className="h-4 w-4" aria-hidden="true" />;
	}
	return <RadioTower className="h-4 w-4" aria-hidden="true" />;
}

function getStatusCopy(status: RealtimeLiveStatus): string {
	switch (status) {
		case "active":
			return "Connected";
		case "connecting":
			return "Connecting";
		case "error":
			return "Error";
		default:
			return "Ready";
	}
}

export function LiveChatModeControls({
	error,
	lastEvent,
	lastTranscript,
	onProviderChange,
	onStart,
	onStop,
	provider,
	showHeader = true,
	status,
}: LiveChatModeControlsProps) {
	const isActive = status === "active";
	const isConnecting = status === "connecting";
	const statusCopy = getStatusCopy(status);

	return (
		<div className="space-y-2">
			{showHeader && (
				<div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-1">
					<div className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
						<RadioTower className="h-4 w-4 shrink-0" />
						<span>Live</span>
						<span className="truncate text-xs font-normal text-zinc-500 dark:text-zinc-400">
							{statusCopy}
						</span>
					</div>
					<span
						className={cn(
							"h-2 w-2 rounded-full",
							isActive ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-zinc-400",
						)}
						aria-hidden="true"
					/>
				</div>
			)}
			<div role="radiogroup" aria-label="Live provider" className="grid gap-1">
				{REALTIME_LIVE_PROVIDER_OPTIONS.map((option) => {
					const isSelected = option.id === provider;

					return (
						<button
							key={option.id}
							type="button"
							role="radio"
							aria-checked={isSelected}
							disabled={isActive || isConnecting}
							onClick={() => onProviderChange(option.id)}
							className={cn(
								"flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
								isSelected
									? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
									: "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
							)}
						>
							<span className="flex h-5 w-5 shrink-0 items-center justify-center">
								<ProviderIcon provider={option.id} />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block font-medium leading-5">{option.label}</span>
								<span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
									{option.transport.toUpperCase()} · {option.description}
								</span>
							</span>
							{isSelected && <Check className="h-4 w-4 text-zinc-500" aria-hidden="true" />}
						</button>
					);
				})}
			</div>
			<button
				type="button"
				disabled={isConnecting}
				onClick={isActive ? onStop : onStart}
				className={cn(
					"flex h-8 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
					isActive
						? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
						: "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-off-white dark:text-zinc-950 dark:hover:bg-zinc-200",
				)}
			>
				{isConnecting ? (
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
				) : isActive ? (
					<Square className="h-4 w-4" aria-hidden="true" />
				) : (
					<RadioTower className="h-4 w-4" aria-hidden="true" />
				)}
				{isActive ? "Stop live session" : "Start live session"}
			</button>
			<div className="min-h-5 truncate px-1 text-xs text-zinc-500 dark:text-zinc-400">
				{error ?? lastTranscript ?? lastEvent}
			</div>
		</div>
	);
}
