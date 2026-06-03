import {
	Check,
	Loader2,
	Mic,
	MicOff,
	Pause,
	AudioLines,
	RadioTower,
	Square,
	Video,
	VideoOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui";
import type { RealtimeCameraDevice, RealtimeLiveStatus } from "~/hooks/useRealtimeLiveSession";
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
	cameraDevices: RealtimeCameraDevice[];
	onProviderChange: (provider: RealtimeLiveProviderId) => void;
	onCameraDeviceChange: (deviceId: string) => void;
	onMicrophoneEnabledChange: (enabled: boolean) => void;
	onStart: () => void;
	onStop: () => void;
	onVideoEnabledChange: (enabled: boolean) => void;
	provider: RealtimeLiveProviderId;
	showHeader?: boolean;
	showSessionControls?: boolean;
	status: RealtimeLiveStatus;
	selectedCameraDeviceId: string;
	videoEnabled: boolean;
	videoPreviewStream?: MediaStream | null;
}

interface LiveSessionControlsProps {
	cameraDevices: RealtimeCameraDevice[];
	error?: string | null;
	inputAudioLevel?: number;
	lastEvent: string;
	lastTranscript?: string | null;
	microphoneEnabled: boolean;
	onCameraDeviceChange: (deviceId: string) => void;
	onMicrophoneEnabledChange: (enabled: boolean) => void;
	onStart: () => void;
	onStop: () => void;
	onVideoEnabledChange: (enabled: boolean) => void;
	outputAudioLevel?: number;
	status: RealtimeLiveStatus;
	selectedCameraDeviceId: string;
	variant?: "panel" | "composer";
	videoEnabled: boolean;
	videoPreviewStream?: MediaStream | null;
	videoSupported: boolean;
}

interface LiveMediaControlsProps {
	microphoneEnabled: boolean;
	onMicrophoneEnabledChange: (enabled: boolean) => void;
	onVideoButtonClick: () => void;
	videoEnabled: boolean;
	videoSupported: boolean;
}

interface LiveComposerTransportProps {
	inputAudioLevel?: number;
	microphoneEnabled: boolean;
	onMicrophoneEnabledChange: (enabled: boolean) => void;
	onStart: () => void;
	onStop: () => void;
	onVideoButtonClick: () => void;
	outputAudioLevel?: number;
	status: RealtimeLiveStatus;
	videoEnabled: boolean;
	videoSupported: boolean;
}

const AUDIO_LEVEL_BAR_WEIGHTS = [0.42, 0.72, 1, 0.62, 0.9, 1.18, 0.76, 1.04, 0.58, 0.82, 0.46];
const ASSISTANT_AUDIO_LEVEL_THRESHOLD = 0.025;

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

function LiveCameraPreview({ stream }: { stream?: MediaStream | null }) {
	const videoRef = useRef<HTMLVideoElement | null>(null);

	useEffect(() => {
		if (!videoRef.current) {
			return;
		}

		videoRef.current.srcObject = stream ?? null;
	}, [stream]);

	if (!stream) {
		return null;
	}

	return (
		<div className="relative aspect-video min-h-16 overflow-hidden rounded-md border border-zinc-200 bg-zinc-950 dark:border-zinc-800">
			<video
				ref={videoRef}
				autoPlay
				muted
				playsInline
				aria-label="Camera preview"
				className="h-full w-full object-cover"
			/>
		</div>
	);
}

function LiveCameraSelector({
	cameraDevices,
	onCameraDeviceChange,
	selectedCameraDeviceId,
}: {
	cameraDevices: RealtimeCameraDevice[];
	onCameraDeviceChange: (deviceId: string) => void;
	selectedCameraDeviceId: string;
}) {
	if (!cameraDevices.length) {
		return (
			<div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
				No cameras found
			</div>
		);
	}

	return (
		<div role="radiogroup" aria-label="Camera" className="grid gap-2">
			{cameraDevices.map((device) => (
				<button
					key={device.deviceId}
					type="button"
					role="radio"
					aria-checked={device.deviceId === selectedCameraDeviceId}
					onClick={() => onCameraDeviceChange(device.deviceId)}
					className={cn(
						"flex min-h-10 w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
						device.deviceId === selectedCameraDeviceId
							? "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100"
							: "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900",
					)}
				>
					<span className="min-w-0 truncate">{device.label}</span>
					{device.deviceId === selectedCameraDeviceId && (
						<Check className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden="true" />
					)}
				</button>
			))}
		</div>
	);
}

function LiveCameraDialog({
	cameraDevices,
	onCameraDeviceChange,
	onOpenChange,
	open,
	selectedCameraDeviceId,
	videoPreviewStream,
}: {
	cameraDevices: RealtimeCameraDevice[];
	onCameraDeviceChange: (deviceId: string) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	selectedCameraDeviceId: string;
	videoPreviewStream?: MediaStream | null;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Camera</DialogTitle>
					<DialogDescription>Choose the camera used for Gemini Live.</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4">
					<div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 dark:border-zinc-800">
						<LiveCameraPreview stream={videoPreviewStream} />
						{!videoPreviewStream && (
							<div className="flex aspect-video items-center justify-center text-sm text-zinc-400">
								Preview starting
							</div>
						)}
					</div>
					<LiveCameraSelector
						cameraDevices={cameraDevices}
						onCameraDeviceChange={onCameraDeviceChange}
						selectedCameraDeviceId={selectedCameraDeviceId}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function LiveMediaControls({
	microphoneEnabled,
	onMicrophoneEnabledChange,
	onVideoButtonClick,
	videoEnabled,
	videoSupported,
}: LiveMediaControlsProps) {
	return (
		<div className="flex min-w-0 shrink-0 items-center gap-1">
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
				onClick={onVideoButtonClick}
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

function LiveAudioLevelMeter({
	inputAudioLevel = 0,
	isActive,
	microphoneEnabled,
	outputAudioLevel = 0,
}: {
	inputAudioLevel?: number;
	isActive: boolean;
	microphoneEnabled: boolean;
	outputAudioLevel?: number;
}) {
	const isAssistantAudio = outputAudioLevel > ASSISTANT_AUDIO_LEVEL_THRESHOLD;
	const level = isActive ? (isAssistantAudio ? outputAudioLevel : inputAudioLevel) : 0;
	const clampedLevel = Math.min(1, Math.max(0, level));
	const value = Math.round(clampedLevel * 100);
	const label = isAssistantAudio ? "Assistant audio level" : "Microphone audio level";
	const barClassName = isAssistantAudio
		? "bg-sky-500 shadow-sky-500/30 dark:bg-sky-300 dark:shadow-sky-300/20"
		: "bg-emerald-500 shadow-emerald-500/30 dark:bg-emerald-300 dark:shadow-emerald-300/20";

	return (
		<div
			role="meter"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={value}
			className={cn(
				"flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border px-3 transition-colors",
				isAssistantAudio
					? "border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/25"
					: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/25",
				!isActive && "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/30",
				isActive && !microphoneEnabled && !isAssistantAudio && "opacity-55",
			)}
		>
			{AUDIO_LEVEL_BAR_WEIGHTS.map((weight, index) => {
				const restingLevel = isActive ? 0.08 : 0.03;
				const weightedLevel = Math.max(restingLevel, Math.min(1, clampedLevel * weight));
				const height = Math.round(6 + weightedLevel * 28);

				return (
					<span
						key={`${weight}-${index}`}
						aria-hidden="true"
						className={cn(
							"w-1.5 rounded-full shadow-sm transition-[height,opacity,background-color] duration-100 ease-out",
							barClassName,
							!isActive && "bg-zinc-300 shadow-none dark:bg-zinc-700",
						)}
						style={{ height }}
					/>
				);
			})}
		</div>
	);
}

function LiveComposerTransport({
	inputAudioLevel,
	microphoneEnabled,
	onMicrophoneEnabledChange,
	onStart,
	onStop,
	onVideoButtonClick,
	outputAudioLevel,
	status,
	videoEnabled,
	videoSupported,
}: LiveComposerTransportProps) {
	const isActive = status === "active";
	const isConnecting = status === "connecting";

	return (
		<div className="flex w-full min-w-0 items-center gap-3">
			<button
				type="button"
				disabled={isConnecting}
				onClick={isActive ? onStop : onStart}
				aria-label={isActive ? "Pause live session" : "Start live session"}
				title={isActive ? "Pause live session" : "Start live session"}
				className={cn(
					"flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-60",
					isActive
						? "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-off-white dark:text-zinc-950 dark:hover:bg-zinc-200"
						: "bg-white text-zinc-800 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
				)}
			>
				{isConnecting ? (
					<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
				) : isActive ? (
					<Pause className="h-5 w-5" aria-hidden="true" />
				) : (
					<AudioLines className="h-5 w-5 fill-current" aria-hidden="true" />
				)}
			</button>
			<button
				type="button"
				aria-label={microphoneEnabled ? "Turn microphone off" : "Turn microphone on"}
				aria-pressed={microphoneEnabled}
				title={microphoneEnabled ? "Turn microphone off" : "Turn microphone on"}
				onClick={() => onMicrophoneEnabledChange(!microphoneEnabled)}
				className={cn(
					"flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors",
					microphoneEnabled
						? "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-300 dark:text-emerald-950 dark:hover:bg-emerald-200"
						: "bg-red-600 text-zinc-500 hover:bg-red-700 dark:bg-red-900 dark:text-red-400 dark:hover:bg-red-800",
				)}
			>
				{microphoneEnabled ? (
					<Mic className="h-5 w-5" aria-hidden="true" />
				) : (
					<MicOff className="h-5 w-5" aria-hidden="true" />
				)}
			</button>
			<LiveAudioLevelMeter
				inputAudioLevel={inputAudioLevel}
				isActive={isActive}
				microphoneEnabled={microphoneEnabled}
				outputAudioLevel={outputAudioLevel}
			/>
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
				onClick={onVideoButtonClick}
				className={cn(
					"flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-45",
					videoEnabled
						? "bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-300 dark:text-sky-950 dark:hover:bg-sky-200"
						: "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
				)}
			>
				{videoEnabled ? (
					<Video className="h-5 w-5" aria-hidden="true" />
				) : (
					<VideoOff className="h-5 w-5" aria-hidden="true" />
				)}
			</button>
		</div>
	);
}

function LiveSessionControls({
	cameraDevices,
	error,
	inputAudioLevel,
	lastEvent,
	lastTranscript,
	microphoneEnabled,
	onCameraDeviceChange,
	onMicrophoneEnabledChange,
	onStart,
	onStop,
	onVideoEnabledChange,
	outputAudioLevel,
	selectedCameraDeviceId,
	status,
	variant = "panel",
	videoEnabled,
	videoPreviewStream,
	videoSupported,
}: LiveSessionControlsProps) {
	const isActive = status === "active";
	const isConnecting = status === "connecting";
	const detail = error ?? lastTranscript ?? lastEvent;
	const [cameraDialogOpen, setCameraDialogOpen] = useState(false);

	const handleVideoButtonClick = () => {
		if (videoEnabled) {
			onVideoEnabledChange(false);
			setCameraDialogOpen(false);
			return;
		}

		onVideoEnabledChange(true);
		setCameraDialogOpen(true);
	};

	if (variant === "composer") {
		return (
			<>
				<LiveComposerTransport
					inputAudioLevel={inputAudioLevel}
					microphoneEnabled={microphoneEnabled}
					onMicrophoneEnabledChange={onMicrophoneEnabledChange}
					onStart={onStart}
					onStop={onStop}
					onVideoButtonClick={handleVideoButtonClick}
					outputAudioLevel={outputAudioLevel}
					status={status}
					videoEnabled={videoEnabled}
					videoSupported={videoSupported}
				/>
				<LiveCameraDialog
					cameraDevices={cameraDevices}
					onCameraDeviceChange={onCameraDeviceChange}
					onOpenChange={setCameraDialogOpen}
					open={cameraDialogOpen}
					selectedCameraDeviceId={selectedCameraDeviceId}
					videoPreviewStream={videoPreviewStream}
				/>
			</>
		);
	}

	return (
		<div className="space-y-2">
			<div className="min-w-0">
				<div className="min-h-5 truncate px-1 text-xs text-zinc-500 dark:text-zinc-400">
					{detail}
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<LiveMediaControls
					microphoneEnabled={microphoneEnabled}
					onMicrophoneEnabledChange={onMicrophoneEnabledChange}
					onVideoButtonClick={handleVideoButtonClick}
					videoEnabled={videoEnabled}
					videoSupported={videoSupported}
				/>
				<button
					type="button"
					disabled={isConnecting}
					onClick={isActive ? onStop : onStart}
					className={cn(
						"flex h-8 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
						"flex-1",
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
			<LiveCameraDialog
				cameraDevices={cameraDevices}
				onCameraDeviceChange={onCameraDeviceChange}
				onOpenChange={setCameraDialogOpen}
				open={cameraDialogOpen}
				selectedCameraDeviceId={selectedCameraDeviceId}
				videoPreviewStream={videoPreviewStream}
			/>
		</div>
	);
}

export function LiveSessionComposerControls(props: Omit<LiveSessionControlsProps, "variant">) {
	return <LiveSessionControls {...props} variant="composer" />;
}

export function LiveChatModeControls({
	cameraDevices,
	error,
	lastEvent,
	lastTranscript,
	microphoneEnabled,
	onCameraDeviceChange,
	onProviderChange,
	onMicrophoneEnabledChange,
	onStart,
	onStop,
	onVideoEnabledChange,
	provider,
	showHeader = true,
	showSessionControls = true,
	status,
	selectedCameraDeviceId,
	videoEnabled,
	videoPreviewStream,
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
					cameraDevices={cameraDevices}
					error={error}
					lastEvent={lastEvent}
					lastTranscript={lastTranscript}
					microphoneEnabled={microphoneEnabled}
					onCameraDeviceChange={onCameraDeviceChange}
					onMicrophoneEnabledChange={onMicrophoneEnabledChange}
					onStart={onStart}
					onStop={onStop}
					onVideoEnabledChange={onVideoEnabledChange}
					selectedCameraDeviceId={selectedCameraDeviceId}
					status={status}
					videoEnabled={videoEnabled}
					videoPreviewStream={videoPreviewStream}
					videoSupported={supportsRealtimeLiveVideoInput(provider)}
				/>
			)}
		</div>
	);
}
