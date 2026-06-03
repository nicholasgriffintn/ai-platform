import {
	Check,
	Copy,
	Edit,
	GitBranch,
	MessageSquareQuote,
	Volume2,
	VolumeX,
	RefreshCw,
	ThumbsDown,
	ThumbsUp,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Popover, PopoverContent, PopoverTrigger } from "~/components/ui";
import { canBranchFromMessage } from "~/lib/chat/branching";
import type { OpinionRequest } from "~/lib/chat/opinion";
import { resolveMessageSpeechAudioSource } from "~/lib/speech/message-speech";
import type { Message } from "~/types";
import { MessageInfo } from "./MessageInfo";
import { InlineModelSelector } from "../InlineModelSelector";
import { OpinionModelSelector } from "../OpinionModelSelector";

export interface MessageActionsProps {
	message: Message;
	copied: boolean;
	copyMessageToClipboard: () => void;
	feedbackState: "none" | "liked" | "disliked";
	isSubmittingFeedback: boolean;
	submitFeedback: (value: 1 | -1) => Promise<void>;
	isSharedView: boolean;
	onRetry?: () => void;
	isRetrying?: boolean;
	onEdit?: () => void;
	isEditing?: boolean;
	onBranch?: (messageId: string, modelId?: string) => void;
	isBranching?: boolean;
	onRequestOpinion?: (messageId: string, request: OpinionRequest) => void;
	isRequestingOpinion?: boolean;
	shouldPromoteOpinion?: boolean;
}

export const MessageActions = ({
	message,
	copied,
	copyMessageToClipboard,
	feedbackState,
	isSubmittingFeedback,
	submitFeedback,
	isSharedView = false,
	onRetry,
	isRetrying = false,
	onEdit,
	isEditing = false,
	onBranch,
	isBranching = false,
	onRequestOpinion,
	isRequestingOpinion = false,
	shouldPromoteOpinion = false,
}: MessageActionsProps) => {
	const [showBranchModelSelector, setShowBranchModelSelector] = useState(false);
	const [showOpinionModelSelector, setShowOpinionModelSelector] = useState(false);
	const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);
	const speechAudioRef = useRef<HTMLAudioElement | null>(null);
	const canBranch = Boolean(onBranch && !isSharedView && canBranchFromMessage(message));
	const canRequestOpinion = Boolean(
		onRequestOpinion && !isSharedView && message.role === "assistant" && message.content,
	);
	const speechAudioSource =
		message.role === "assistant" ? resolveMessageSpeechAudioSource(message) : undefined;

	const handleAssistantBranchClick = useCallback(() => {
		if (!onBranch) {
			return;
		}
		onBranch(message.id);
	}, [message.id, onBranch]);

	const handleModelSelected = useCallback(
		(modelId: string) => {
			setShowBranchModelSelector(false);
			if (onBranch) {
				onBranch(message.id, modelId);
			}
		},
		[onBranch, message.id],
	);

	const handleCancelModelSelection = useCallback(() => {
		setShowBranchModelSelector(false);
	}, []);

	const handleOpinionSubmit = useCallback(
		(request: OpinionRequest) => {
			setShowOpinionModelSelector(false);
			if (onRequestOpinion) {
				onRequestOpinion(message.id, request);
			}
		},
		[message.id, onRequestOpinion],
	);

	const handleCancelOpinionSelection = useCallback(() => {
		setShowOpinionModelSelector(false);
	}, []);

	const stopSpeechPlayback = useCallback(() => {
		const currentAudio = speechAudioRef.current;
		if (currentAudio) {
			currentAudio.pause();
			currentAudio.removeAttribute("src");
			currentAudio.load();
		}
		speechAudioRef.current = null;
		setIsPlayingSpeech(false);
	}, []);

	const handleReplaySpeech = useCallback(() => {
		if (!speechAudioSource) {
			return;
		}

		if (isPlayingSpeech) {
			stopSpeechPlayback();
			return;
		}

		stopSpeechPlayback();

		const audio = new Audio(speechAudioSource);
		speechAudioRef.current = audio;
		audio.onended = () => {
			speechAudioRef.current = null;
			setIsPlayingSpeech(false);
		};
		audio.onerror = () => {
			speechAudioRef.current = null;
			setIsPlayingSpeech(false);
			toast.error("Failed to play generated speech");
		};
		setIsPlayingSpeech(true);
		void audio.play().catch(() => {
			setIsPlayingSpeech(false);
			toast.error("Failed to play generated speech");
		});
	}, [isPlayingSpeech, speechAudioSource, stopSpeechPlayback]);

	return (
		<div className="flex flex-wrap justify-end items-center gap-2">
			<div className="flex items-center space-x-1">
				{message.role !== "user" && message.content && (
					<Button
						type="button"
						variant="icon"
						onClick={copyMessageToClipboard}
						className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center ${
							copied
								? "text-green-500 dark:text-green-400 bg-green-100/50 dark:bg-green-900/20"
								: "text-zinc-500 dark:text-zinc-400"
						}`}
						title={copied ? "Copied!" : "Copy message"}
						aria-label={copied ? "Copied!" : "Copy message"}
					>
						{copied ? <Check size={14} /> : <Copy size={14} />}
					</Button>
				)}
				{speechAudioSource && (
					<Button
						type="button"
						variant="icon"
						onClick={handleReplaySpeech}
						className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center ${
							isPlayingSpeech
								? "text-emerald-500 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/20"
								: "text-zinc-500 dark:text-zinc-400"
						}`}
						title={isPlayingSpeech ? "Stop response audio" : "Replay response audio"}
						aria-label={isPlayingSpeech ? "Stop response audio" : "Replay response audio"}
					>
						{isPlayingSpeech ? <VolumeX size={14} /> : <Volume2 size={14} />}
					</Button>
				)}
				{message.role === "user" && onEdit && !isSharedView && (
					<Button
						type="button"
						variant="icon"
						onClick={onEdit}
						disabled={isEditing}
						className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center text-zinc-500 dark:text-zinc-400 ${
							isEditing ? "opacity-50 cursor-not-allowed" : ""
						}`}
						title={isEditing ? "Editing..." : "Edit message"}
						aria-label={isEditing ? "Editing..." : "Edit message"}
					>
						<Edit size={14} />
					</Button>
				)}
				{onRetry && !isSharedView && (
					<Button
						type="button"
						variant="icon"
						onClick={onRetry}
						disabled={isRetrying}
						className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center text-zinc-500 dark:text-zinc-400 ${
							isRetrying ? "opacity-50 cursor-not-allowed" : ""
						}`}
						title={isRetrying ? "Retrying..." : "Retry message"}
						aria-label={isRetrying ? "Retrying..." : "Retry message"}
					>
						<RefreshCw size={14} className={isRetrying ? "animate-spin" : ""} />
					</Button>
				)}
				{canRequestOpinion && (
					<Popover open={showOpinionModelSelector} onOpenChange={setShowOpinionModelSelector}>
						<PopoverTrigger asChild>
							<Button
								type="button"
								variant={shouldPromoteOpinion ? "secondary" : "icon"}
								disabled={isRequestingOpinion}
								className={`cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center text-zinc-500 dark:text-zinc-400 ${
									shouldPromoteOpinion ? "px-2 py-1 text-xs" : "p-1"
								} ${isRequestingOpinion ? "opacity-50 cursor-not-allowed" : ""}`}
								title={isRequestingOpinion ? "Requesting opinion..." : "Get second opinion"}
								aria-label={isRequestingOpinion ? "Requesting opinion..." : "Get second opinion"}
							>
								<MessageSquareQuote size={14} />
								{shouldPromoteOpinion && <span className="ml-1.5">Second opinion</span>}
							</Button>
						</PopoverTrigger>
						<PopoverContent
							side="top"
							align="end"
							sideOffset={8}
							collisionPadding={{ top: 64, right: 8, bottom: 112, left: 8 }}
							className="w-[calc(100vw-1rem)] max-w-[24rem] overflow-hidden border-zinc-200 bg-white p-0 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
						>
							<OpinionModelSelector
								onSubmit={handleOpinionSubmit}
								onCancel={handleCancelOpinionSelection}
								sourceModelId={message.model}
								className="w-full"
							/>
						</PopoverContent>
					</Popover>
				)}
				{canBranch && (
					<div className="relative flex items-center">
						{message.role === "user" ? (
							<Popover open={showBranchModelSelector} onOpenChange={setShowBranchModelSelector}>
								<PopoverTrigger asChild>
									<Button
										type="button"
										variant="icon"
										disabled={isBranching}
										className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center text-zinc-500 dark:text-zinc-400 ${
											isBranching ? "opacity-50 cursor-not-allowed" : ""
										}`}
										title={isBranching ? "Branching..." : "Branch conversation"}
										aria-label={isBranching ? "Branching..." : "Branch conversation"}
									>
										<GitBranch size={14} />
									</Button>
								</PopoverTrigger>
								<PopoverContent
									side="top"
									align="end"
									sideOffset={8}
									collisionPadding={{ top: 64, right: 8, bottom: 112, left: 8 }}
									className="w-[calc(100vw-1rem)] max-w-[22rem] overflow-hidden border-zinc-200 bg-white p-0 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
								>
									<InlineModelSelector
										onModelSelect={handleModelSelected}
										onCancel={handleCancelModelSelection}
										className="w-full"
									/>
								</PopoverContent>
							</Popover>
						) : (
							<Button
								type="button"
								variant="icon"
								onClick={handleAssistantBranchClick}
								disabled={isBranching}
								className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center text-zinc-500 dark:text-zinc-400 ${
									isBranching ? "opacity-50 cursor-not-allowed" : ""
								}`}
								title={isBranching ? "Branching..." : "Branch conversation"}
								aria-label={isBranching ? "Branching..." : "Branch conversation"}
							>
								<GitBranch size={14} />
							</Button>
						)}
					</div>
				)}
				{message.role !== "user" && (message.created || message.timestamp) && (
					<MessageInfo
						message={message}
						buttonClassName={
							"cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center text-zinc-500 dark:text-zinc-400"
						}
					/>
				)}
			</div>
			{!isSharedView && message.role !== "user" && message.log_id && (
				<div className="flex items-center space-x-1">
					<span className="text-xs text-zinc-600 dark:text-zinc-300">Helpful?</span>
					<Button
						type="button"
						variant="icon"
						onClick={() => submitFeedback(1)}
						disabled={isSubmittingFeedback || feedbackState === "liked"}
						className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 ${
							feedbackState === "liked"
								? "text-green-500 dark:text-green-400 bg-green-100/50 dark:bg-green-900/20"
								: "text-zinc-500 dark:text-zinc-400"
						} ${
							isSubmittingFeedback || feedbackState === "liked"
								? "opacity-50 cursor-not-allowed"
								: ""
						}`}
						title={feedbackState === "liked" ? "Feedback submitted" : "Thumbs up"}
						aria-label={feedbackState === "liked" ? "Feedback submitted" : "Thumbs up"}
					>
						<ThumbsUp size={14} />
					</Button>
					<Button
						type="button"
						variant="icon"
						onClick={() => submitFeedback(-1)}
						disabled={isSubmittingFeedback || feedbackState === "disliked"}
						className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 ${
							feedbackState === "disliked"
								? "text-red-500 dark:text-red-400 bg-red-100/50 dark:bg-red-900/20"
								: "text-zinc-500 dark:text-zinc-400"
						} ${
							isSubmittingFeedback || feedbackState === "disliked"
								? "opacity-50 cursor-not-allowed"
								: ""
						}`}
						title={feedbackState === "disliked" ? "Feedback submitted" : "Thumbs down"}
						aria-label={feedbackState === "disliked" ? "Feedback submitted" : "Thumbs down"}
					>
						<ThumbsDown size={14} />
					</Button>
				</div>
			)}
		</div>
	);
};
