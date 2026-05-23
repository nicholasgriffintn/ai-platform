import { Loader2, Mic, Plus, Square, Volume1, Volume2, VolumeX } from "lucide-react";
import type { ReactNode } from "react";

import { Button, Popover, PopoverContent, PopoverTrigger } from "~/components/ui";
import { cn } from "~/lib/utils";

interface ComposerActionMenuProps {
	autoPlayResponses?: {
		enabled: boolean;
		isGenerating: boolean;
		isPlaying: boolean;
		onToggle: () => void;
	};
	canUseVoice: boolean;
	canUploadFiles: boolean;
	isDisabled?: boolean;
	isRecording: boolean;
	isTranscribing: boolean;
	isUploading: boolean;
	onStartRecording: () => void;
	onStopRecording: () => void;
	onUploadClick: () => void;
	tools?: ReactNode;
	uploadIcon: ReactNode;
	uploadLabel: string;
}

function ComposerActionButton({
	children,
	description,
	icon,
	isActive = false,
	onClick,
	title,
	disabled,
}: {
	children: ReactNode;
	description?: string;
	icon: ReactNode;
	isActive?: boolean;
	onClick: () => void;
	title: string;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
				isActive
					? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
					: "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
				disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
			)}
			title={title}
		>
			<span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
				{icon}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-medium leading-5">{children}</span>
				{description && (
					<span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
						{description}
					</span>
				)}
			</span>
		</button>
	);
}

export function ComposerActionMenu({
	autoPlayResponses,
	canUploadFiles,
	canUseVoice,
	isDisabled = false,
	isRecording,
	isTranscribing,
	isUploading,
	onStartRecording,
	onStopRecording,
	onUploadClick,
	tools,
	uploadIcon,
	uploadLabel,
}: ComposerActionMenuProps) {
	const hasActions = canUploadFiles || canUseVoice || Boolean(autoPlayResponses) || tools;

	if (!hasActions) {
		return null;
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="icon"
					className="h-8 w-8 shrink-0 p-1.5"
					title="Open composer actions"
					aria-label="Open composer actions"
				>
					{isUploading ? (
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
					) : (
						<Plus className="h-4 w-4" aria-hidden="true" />
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent side="top" align="start" sideOffset={10} className="w-80 rounded-xl p-2">
				<div className="space-y-1">
					{canUploadFiles && (
						<ComposerActionButton
							icon={isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : uploadIcon}
							onClick={onUploadClick}
							disabled={isDisabled || isUploading}
							title={uploadLabel}
							description="Images, documents, audio, and code when supported"
						>
							Attach file
						</ComposerActionButton>
					)}
					{canUseVoice && (
						<ComposerActionButton
							icon={
								isRecording ? (
									<Square className="h-5 w-5 text-red-500" />
								) : isTranscribing ? (
									<Loader2 className="h-5 w-5 animate-spin" />
								) : (
									<Mic className="h-5 w-5" />
								)
							}
							onClick={isRecording ? onStopRecording : onStartRecording}
							disabled={isDisabled || isTranscribing}
							title={isRecording ? "Stop recording" : "Start recording"}
							description={isTranscribing ? "Transcribing voice input" : "Dictate a message"}
							isActive={isRecording}
						>
							{isRecording ? "Stop voice input" : "Voice input"}
						</ComposerActionButton>
					)}
					{autoPlayResponses && (
						<ComposerActionButton
							icon={
								autoPlayResponses.isPlaying ? (
									<Volume1 className="h-5 w-5" />
								) : autoPlayResponses.isGenerating ? (
									<Loader2 className="h-5 w-5 animate-spin" />
								) : autoPlayResponses.enabled ? (
									<Volume2 className="h-5 w-5" />
								) : (
									<VolumeX className="h-5 w-5" />
								)
							}
							onClick={autoPlayResponses.onToggle}
							disabled={isDisabled}
							title={autoPlayResponses.enabled ? "Disable response audio" : "Enable response audio"}
							description="Play assistant replies automatically"
							isActive={autoPlayResponses.enabled}
						>
							Response audio
						</ComposerActionButton>
					)}
				</div>
				{tools && <div className="mt-2">{tools}</div>}
			</PopoverContent>
		</Popover>
	);
}
