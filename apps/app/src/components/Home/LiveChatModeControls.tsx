import { Check, Loader2, Mic, MicOff, RadioTower, Square, Video, VideoOff } from "lucide-react";

import type { RealtimeLiveStatus } from "~/hooks/useRealtimeLiveSession";
import {
	REALTIME_LIVE_PROVIDER_OPTIONS,
	type RealtimeLiveProviderId,
	type RealtimeLiveProviderOption,
	supportsRealtimeLiveVideoInput,
} from "~/lib/realtime/live-providers";
import { cn } from "~/lib/utils";

interface LiveChatModeControlsProps {
	error?: string | null;
	lastEvent: string;
	lastTranscript?: string | null;
	microphoneEnabled: boolean;
	onProviderChange: (provider: RealtimeLiveProviderId) => void;
	onMicrophoneEnabledChange: (enabled: boolean) => void;
	onStart: () => void;
	onStop: () => void;
	onVideoEnabledChange: (enabled: boolean) => void;
	provider: RealtimeLiveProviderId;
	showHeader?: boolean;
	showSessionControls?: boolean;
	status: RealtimeLiveStatus;
	videoEnabled: boolean;
}

interface LiveSessionControlsProps {
	error?: string | null;
	lastEvent: string;
	lastTranscript?: string | null;
	microphoneEnabled: boolean;
	onMicrophoneEnabledChange: (enabled: boolean) => void;
	onStart: () => void;
	onStop: () => void;
	onVideoEnabledChange: (enabled: boolean) => void;
	status: RealtimeLiveStatus;
	variant?: "panel" | "composer";
	videoEnabled: boolean;
	videoSupported: boolean;
}

function ProviderIcon({ option }: { option: RealtimeLiveProviderOption }) {
	if (option.inputModalities.includes("video")) {
		return <Video className="h-4 w-4" aria-hidden="true" />;
	}
	if (option.sessionType === "transcription") {
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

function LiveMediaControls({
	microphoneEnabled,
	onMicrophoneEnabledChange,
	onVideoEnabledChange,
	videoEnabled,
	videoSupported,
}: Pick<
	LiveSessionControlsProps,
	| "microphoneEnabled"
	| "onMicrophoneEnabledChange"
	| "onVideoEnabledChange"
	| "videoEnabled"
	| "videoSupported"
>) {
	return (
		<div className="flex shrink-0 items-center gap-1">
			<button
				type="button"
				aria-label={microphoneEnabled ? "Turn microphone off" : "Turn microphone on"}
				aria-pressed={microphoneEnabled}
				title={microphoneEnabled ? "Turn microphone off" : "Turn microphone on"}
				onClick={() => onMicrophoneEnabledChange(!microphoneEnabled)}
				className={cn(
					"flex h-8 w-8 items-center justify-center rounded-md transition-colors",
					microphoneEnabled
						? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
						: "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
				)}
			>
				{microphoneEnabled ? (
					<Mic className="h-4 w-4" aria-hidden="true" />
				) : (
					<MicOff className="h-4 w-4" aria-hidden="true" />
				)}
			</button>
			<button
				type="button"
				aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
				aria-pressed={videoEnabled}
				disabled={!videoSupported}
				title={
					videoSupported
						? videoEnabled
							? "Turn camera off"
							: "Turn camera on"
						: "Camera is available with Gemini Live"
				}
				onClick={() => onVideoEnabledChange(!videoEnabled)}
				className={cn(
					"flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50",
					videoEnabled
						? "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-950/50"
						: "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
				)}
			>
				{videoEnabled ? (
					<Video className="h-4 w-4" aria-hidden="true" />
				) : (
					<VideoOff className="h-4 w-4" aria-hidden="true" />
				)}
			</button>
		</div>
	);
}

function LiveSessionControls({
	error,
	lastEvent,
	lastTranscript,
	microphoneEnabled,
	onMicrophoneEnabledChange,
	onStart,
	onStop,
	onVideoEnabledChange,
	status,
	variant = "panel",
	videoEnabled,
	videoSupported,
}: LiveSessionControlsProps) {
	const isActive = status === "active";
	const isConnecting = status === "connecting";
	const statusCopy = getStatusCopy(status);
	const detail = error ?? lastTranscript ?? lastEvent;
	const isComposer = variant === "composer";

	return (
		<div
			className={cn(
				isComposer
					? "flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
					: "space-y-2",
			)}
		>
			<div className={cn("min-w-0", isComposer && "flex-1")}>
				{isComposer && (
					<div className="mb-1 flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
						<span
							className={cn(
								"h-2 w-2 shrink-0 rounded-full",
								isActive ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-zinc-400",
							)}
							aria-hidden="true"
						/>
						<span>Live session</span>
						<span className="truncate text-xs font-normal text-zinc-500 dark:text-zinc-400">
							{statusCopy}
						</span>
					</div>
				)}
				<div
					className={cn(
						"min-h-5 truncate text-xs text-zinc-500 dark:text-zinc-400",
						!isComposer && "px-1",
					)}
				>
					{detail}
				</div>
			</div>
			<div className={cn("flex shrink-0 items-center gap-2", isComposer && "w-full sm:w-auto")}>
				<LiveMediaControls
					microphoneEnabled={microphoneEnabled}
					onMicrophoneEnabledChange={onMicrophoneEnabledChange}
					onVideoEnabledChange={onVideoEnabledChange}
					videoEnabled={videoEnabled}
					videoSupported={videoSupported}
				/>
				<button
					type="button"
					disabled={isConnecting}
					onClick={isActive ? onStop : onStart}
					className={cn(
						"flex h-8 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
						isComposer ? "min-w-0 flex-1 sm:flex-none" : "flex-1",
						isActive
							? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
							: "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-off-white dark:text-zinc-950 dark:hover:bg-zinc-200",
					)}
				>
					{isConnecting ? (
						<Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
					) : isActive ? (
						<Square className="h-4 w-4 shrink-0" aria-hidden="true" />
					) : (
						<RadioTower className="h-4 w-4 shrink-0" aria-hidden="true" />
					)}
					<span className="truncate">{isActive ? "Stop live session" : "Start live session"}</span>
				</button>
			</div>
		</div>
	);
}

export function LiveSessionComposerControls(props: Omit<LiveSessionControlsProps, "variant">) {
	return <LiveSessionControls {...props} variant="composer" />;
}

export function LiveChatModeControls({
	error,
	lastEvent,
	lastTranscript,
	microphoneEnabled,
	onProviderChange,
	onMicrophoneEnabledChange,
	onStart,
	onStop,
	onVideoEnabledChange,
	provider,
	showHeader = true,
	showSessionControls = true,
	status,
	videoEnabled,
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
								<ProviderIcon option={option} />
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
			{showSessionControls && (
				<LiveSessionControls
					error={error}
					lastEvent={lastEvent}
					lastTranscript={lastTranscript}
					microphoneEnabled={microphoneEnabled}
					onMicrophoneEnabledChange={onMicrophoneEnabledChange}
					onStart={onStart}
					onStop={onStop}
					onVideoEnabledChange={onVideoEnabledChange}
					status={status}
					videoEnabled={videoEnabled}
					videoSupported={supportsRealtimeLiveVideoInput(provider)}
				/>
			)}
		</div>
	);
}
