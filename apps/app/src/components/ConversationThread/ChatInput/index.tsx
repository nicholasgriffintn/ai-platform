import { File, Image, Loader2, Paperclip, Pause, Send, Volume2, FileCode } from "lucide-react";
import {
	type ChangeEvent,
	type FormEvent,
	type KeyboardEvent,
	type ReactNode,
	forwardRef,
	useEffect,
	useId,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { Button } from "~/components/ui";
import { useModels } from "~/hooks/useModels";
import { useVoiceRecorder } from "~/hooks/useVoiceRecorder";
import type { AttachmentData } from "~/lib/chat/prepare-user-message";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import type { ModelConfigItem } from "~/types";
import { ChatSettings as ChatSettingsComponent } from "./ChatSettings";
import { ToolToggles } from "./ChatSettings/ToolToggles";
import { ComposerActionMenu } from "./ComposerActionMenu";
import {
	ComposerCommandButton,
	ComposerCommandChips,
	ComposerCommandSuggestions,
} from "./ComposerCommandSurface";
import type { ComposerCommandAction } from "./composerCommandTypes";
import { InlineResponseControls } from "./InlineResponseControls";
import { ModelSelector } from "./ModelSelector";
import { useComposerCommandController } from "./useComposerCommandController";
import { uploadComposerAttachment } from "./uploadAttachment";

export interface ChatInputHandle {
	focus: () => void;
}

interface ChatInputProps {
	handleSubmit: (e: FormEvent, attachments?: AttachmentData[]) => void;
	isLoading: boolean;
	streamStarted: boolean;
	controller: AbortController;
	onTranscribe: (data: { response: { content: string } }) => void;
	placeholder?: {
		newConversation: string;
		followUp: string;
	};
	controls?: ReactNode;
	modeControls?: {
		activeModeControls?: ReactNode;
		commands?: ComposerCommandAction[];
		onClearActive?: () => void;
	};
	modelScope?: "default" | "text-only";
	disableAttachments?: boolean;
	hideDefaultControls?: boolean;
	autoPlayResponses?: {
		enabled: boolean;
		isGenerating: boolean;
		isPlaying: boolean;
		onToggle: () => void;
	};
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
	(
		{
			handleSubmit,
			isLoading,
			streamStarted,
			controller,
			onTranscribe,
			placeholder,
			controls,
			modeControls,
			modelScope = "default",
			disableAttachments = false,
			hideDefaultControls = false,
			autoPlayResponses,
		},
		ref,
	) => {
		const { isMobile } = useUIStore();
		const { model, chatInput, setChatInput, chatMode, selectedAgentId } = useChatStore();
		const { isPro, currentConversationId } = useChatStore();
		const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceRecorder({
			onTranscribe,
		});
		const [selectedAttachments, setSelectedAttachments] = useState<AttachmentData[]>([]);
		const [isMultimodalModel, setIsMultimodalModel] = useState(false);
		const [isImageModel, setIsImageModel] = useState(false);
		const [isTextToImageOnlyModel, setIsTextToImageOnlyModel] = useState(false);
		const [supportsDocuments, setSupportsDocuments] = useState(false);
		const [supportsAudio, setSupportsAudio] = useState(false);
		const [supportsCode, setSupportsCode] = useState(false);
		const [supportsToolCalls, setsupportsToolCalls] = useState(false);
		const [supportsCodeExecution, setSupportsCodeExecution] = useState(false);
		const [supportsSearchGrounding, setSupportsSearchGrounding] = useState(false);
		const { data: apiModels } = useModels();
		const [isUploading, setIsUploading] = useState(false);

		const textareaRef = useRef<HTMLTextAreaElement>(null);
		const fileInputRef = useRef<HTMLInputElement>(null);
		const fileInputId = useId();
		const {
			applyDirectiveSelection,
			commandState,
			directiveQuery,
			moveActiveSuggestion,
			setTextareaCursorPosition,
		} = useComposerCommandController({ isLoading, modeControls });

		useImperativeHandle(ref, () => ({
			focus: () => {
				textareaRef.current?.focus();
			},
		}));

		useEffect(() => {
			if (textareaRef.current) {
				textareaRef.current.style.height = "auto";
				textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
			}
		}, [chatInput]);

		useEffect(() => {
			if (!apiModels || !model) {
				setIsMultimodalModel(false);
				setIsImageModel(false);
				setIsTextToImageOnlyModel(false);
				setSupportsDocuments(false);
				setSupportsAudio(false);
				setSupportsCode(false);
				setsupportsToolCalls(false);
				setSupportsCodeExecution(false);
				setSupportsSearchGrounding(false);
				return;
			}

			const modelData = apiModels[model] as ModelConfigItem | undefined;

			const inputs = modelData?.modalities?.input ?? ["text"];
			const outputs = modelData?.modalities?.output ?? inputs;
			const hasTextToImage =
				outputs.includes("image") && !outputs.includes("text") && !inputs.includes("image");
			const hasImageToImage = outputs.includes("image") && inputs.includes("image");
			const hasImageToText = outputs.includes("text") && inputs.includes("image");
			const multimodal = !!modelData?.multimodal || hasImageToText;
			setIsMultimodalModel(multimodal);
			const textOnlyToImage = hasTextToImage && !hasImageToImage && !hasImageToText;
			setIsTextToImageOnlyModel(textOnlyToImage);
			const supportsNativeDocuments = !!modelData?.supportsDocuments && !textOnlyToImage;
			const supportsNativeAudio = !!modelData?.supportsAudio && !textOnlyToImage;
			const imageOnly =
				(hasImageToImage || hasImageToText) && !supportsNativeDocuments && !supportsNativeAudio;
			setIsImageModel(imageOnly);
			setSupportsDocuments(supportsNativeDocuments);
			setSupportsAudio(supportsNativeAudio);
			setSupportsCode(supportsNativeDocuments);
			setsupportsToolCalls(!!modelData?.supportsToolCalls);
			setSupportsCodeExecution(!!modelData?.supportsCodeExecution);
			setSupportsSearchGrounding(!!modelData?.supportsSearchGrounding);
		}, [model, apiModels]);

		const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
			if ((e.key === "ArrowDown" || e.key === "ArrowUp") && directiveQuery) {
				const didMove = moveActiveSuggestion(e.key === "ArrowDown" ? 1 : -1);
				if (didMove) {
					e.preventDefault();
					return;
				}
			}

			if ((e.key === "Enter" || e.key === "Tab") && directiveQuery) {
				const didApplyDirective = applyDirectiveSelection();
				if (didApplyDirective) {
					e.preventDefault();
					return;
				}
			}

			if (
				e.key === "Backspace" &&
				e.currentTarget.selectionStart === 0 &&
				e.currentTarget.selectionEnd === 0 &&
				modeControls?.onClearActive
			) {
				e.preventDefault();
				modeControls.onClearActive();
				return;
			}

			if (isMobile && e.key === "Enter") {
				return;
			}

			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				const attachments = selectedAttachments.length > 0 ? selectedAttachments : undefined;
				clearSelectedAttachments();
				handleSubmit(e as unknown as FormEvent, attachments);
			}
			if (e.key === "Enter" && e.shiftKey) {
				e.preventDefault();
				const textarea = textareaRef.current;
				if (textarea) {
					const cursorPosition = textarea.selectionStart;
					const textBeforeCursor = chatInput.substring(0, cursorPosition);
					const textAfterCursor = chatInput.substring(cursorPosition);
					setChatInput(`${textBeforeCursor}\n${textAfterCursor}`);

					setTimeout(() => {
						textarea.selectionStart = textarea.selectionEnd = cursorPosition + 1;
					}, 0);
				}
			}
		};

		const handleTextAreaInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
			setTextareaCursorPosition(e.target.selectionStart);
			setChatInput(e.target.value);
		};

		const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(e.target.files ?? []);
			if (files.length === 0) {
				return;
			}

			try {
				setIsUploading(true);
				const uploadedAttachments: AttachmentData[] = [];

				for (const file of files) {
					const result = await uploadComposerAttachment(file, {
						isImageModel,
						isMultimodalModel,
						isTextToImageOnlyModel,
						supportsAudio,
						supportsDocuments,
					});

					if ("error" in result) {
						alert(result.error);
					} else {
						uploadedAttachments.push(result.attachment);
					}
				}

				if (uploadedAttachments.length > 0) {
					setSelectedAttachments((currentAttachments) => [
						...currentAttachments,
						...uploadedAttachments,
					]);
				}
			} catch (error) {
				console.error("Failed to upload file:", error);
				alert(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`);
			} finally {
				setIsUploading(false);
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
			}
		};

		const clearSelectedAttachments = () => {
			setSelectedAttachments([]);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		};

		const removeSelectedAttachment = (indexToRemove: number) => {
			setSelectedAttachments((currentAttachments) =>
				currentAttachments.filter((_, index) => index !== indexToRemove),
			);
		};

		const handleFormSubmit = (e: FormEvent) => {
			const attachments = selectedAttachments.length > 0 ? selectedAttachments : undefined;
			clearSelectedAttachments();
			handleSubmit(e, attachments);
		};

		const getFileTypeAccept = () => {
			if (isImageModel) {
				return "image/*";
			}

			const fileTypes = [
				"text/markdown",
				"text/html",
				"application/xml",
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				"application/vnd.ms-excel.sheet.macroenabled.12",
				"application/vnd.ms-excel.sheet.binary.macroenabled.12",
				"application/vnd.ms-excel",
				"application/vnd.oasis.opendocument.spreadsheet",
				"text/csv",
				"application/vnd.apple.numbers",
				"application/pdf",
				".ts",
				".tsx",
				".js",
				".jsx",
				".json",
				".py",
				".go",
				".java",
				".rb",
				".php",
				".rs",
				".cs",
				".kt",
				".swift",
				".scala",
				".sh",
				".yml",
				".yaml",
				".sql",
				".toml",
				".c",
				".cc",
				".cpp",
				".cxx",
				".hpp",
				".h",
				"text/javascript",
				"application/javascript",
				"text/typescript",
				"application/typescript",
				"text/plain",
				"application/json",
			];

			if (isMultimodalModel) {
				fileTypes.push("image/*");
			}

			if (supportsAudio) {
				fileTypes.push("audio/*");
			}

			return fileTypes.join(",");
		};

		const getUploadButtonIcon = () => {
			if (isImageModel) {
				return <Image className="h-4 w-4" />;
			}
			if (isMultimodalModel || supportsAudio) {
				return (
					<span className="flex space-x-1">
						{isMultimodalModel && <Image className="h-4 w-4" />}
						{supportsDocuments && <File className="h-4 w-4" />}
						{supportsCode && <FileCode className="h-4 w-4" />}
						{supportsAudio && <Volume2 className="h-4 w-4" />}
						{!supportsDocuments && !supportsAudio && <Paperclip className="h-4 w-4" />}
					</span>
				);
			}
			if (supportsDocuments) {
				return supportsCode ? <FileCode className="h-4 w-4" /> : <File className="h-4 w-4" />;
			}

			return <Paperclip className="h-4 w-4" />;
		};

		const getAttachmentIconAndLabel = (attachment: AttachmentData) => {
			if (attachment.type === "image") {
				return {
					preview: (
						<img src={attachment.data} alt="Selected" className="h-4 w-4 rounded object-cover" />
					),
					label: "Image attached",
				};
			}
			if (attachment.type === "document" || attachment.type === "markdown_document") {
				return {
					preview: <File className="h-3.5 w-3.5" aria-hidden="true" />,
					label:
						attachment.type === "markdown_document"
							? `${attachment.name || "Document"} (converted to text)`
							: attachment.name || "Document attached",
				};
			}
			if (attachment.type === "audio") {
				return {
					preview: <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />,
					label: attachment.name || "Audio attached",
				};
			}
			return { preview: null, label: "" };
		};

		const canUploadFiles = !disableAttachments && !isTextToImageOnlyModel;

		const attachmentChips = selectedAttachments.flatMap((attachment, index) => {
			const { preview, label } = getAttachmentIconAndLabel(attachment);
			return preview
				? [
						{
							label,
							onClear: () => removeSelectedAttachment(index),
							preview,
						},
					]
				: [];
		});

		const isToolSelectionLocked = chatMode === "agent" && selectedAgentId !== null;
		const canUseProComposerActions = isPro;
		const canShowToolMenu =
			(isPro && !model && chatMode === "remote") ||
			(supportsToolCalls && (supportsCodeExecution || supportsSearchGrounding));
		const canShowActionMenu = canUseProComposerActions || canShowToolMenu;

		return (
			<div
				data-chat-input-shell
				className="relative rounded-lg border border-zinc-200 dark:border-zinc-700 bg-off-white dark:bg-[#121212] shadow-sm hover:border-zinc-300 dark:hover:border-zinc-600 focus-within:border-zinc-300 dark:focus-within:border-zinc-500 transition-colors"
			>
				<div className="flex flex-col">
					<ComposerCommandChips
						{...commandState}
						attachments={attachmentChips}
						onClearMode={modeControls?.onClearActive}
					/>
					{canUploadFiles && (
						<input
							type="file"
							ref={fileInputRef}
							accept={getFileTypeAccept()}
							onChange={handleFileUpload}
							className="hidden"
							id={fileInputId}
							aria-label="Upload a file (images, documents, audio, and code)"
							multiple
						/>
					)}
					<div className="relative">
						<ComposerCommandSuggestions {...commandState} />
						<div className="flex items-start">
							<div className="flex min-w-0 flex-grow items-start gap-2 px-4 py-3">
								<textarea
									id="message-input"
									ref={textareaRef}
									value={chatInput}
									onChange={handleTextAreaInput}
									onClick={(e) => setTextareaCursorPosition(e.currentTarget.selectionStart)}
									onKeyUp={(e) => setTextareaCursorPosition(e.currentTarget.selectionStart)}
									onKeyDown={handleKeyDown}
									placeholder={
										!currentConversationId
											? (placeholder?.newConversation ?? "Ask me anything...")
											: (placeholder?.followUp ?? "Ask follow-up questions...")
									}
									disabled={isRecording || isTranscribing || isLoading}
									className="min-h-[36px] max-h-[200px] min-w-0 flex-grow resize-none bg-transparent p-0 text-base focus:outline-none dark:text-white"
									rows={1}
									aria-label="Message input"
									aria-describedby="message-input-help"
								/>
							</div>
							<div id="message-input-help" className="sr-only">
								Type your message and press Enter to send. Use Shift+Enter for a new line.
							</div>

							<div className="flex flex-shrink-0 items-center gap-1 pr-3 pt-3">
								{isLoading && streamStarted ? (
									<Button
										type="button"
										onClick={() => controller.abort()}
										variant="icon"
										className="cursor-pointer p-2 hover:bg-off-white-highlight dark:hover:bg-zinc-800 rounded-md text-zinc-600 dark:text-zinc-400"
										title="Stop generating"
										aria-label="Stop generating"
									>
										<Pause className="h-5 w-5" />
									</Button>
								) : (
									<>
										{!hideDefaultControls && canShowActionMenu && (
											<ComposerActionMenu
												autoPlayResponses={canUseProComposerActions ? autoPlayResponses : undefined}
												canUseVoice={canUseProComposerActions}
												canUploadFiles={canUseProComposerActions && canUploadFiles}
												isDisabled={isLoading}
												isRecording={isRecording}
												isTranscribing={isTranscribing}
												isUploading={isUploading}
												onStartRecording={startRecording}
												onStopRecording={stopRecording}
												onUploadClick={() => fileInputRef.current?.click()}
												tools={
													canShowToolMenu ? (
														<ToolToggles
															isDisabled={isLoading || isToolSelectionLocked}
															variant="menu"
														/>
													) : undefined
												}
												uploadIcon={getUploadButtonIcon()}
												uploadLabel={`Upload ${isMultimodalModel || supportsAudio ? "files (images, audio, documents, code)" : "a Document or Code file"}`}
											/>
										)}
										{!hideDefaultControls && <ComposerCommandButton {...commandState} />}
										<Button
											type="submit"
											onClick={handleFormSubmit}
											disabled={
												!!(
													(!chatInput?.trim() && selectedAttachments.length === 0) ||
													isLoading ||
													isUploading
												)
											}
											className="cursor-pointer p-2.5 bg-black hover:bg-zinc-800 dark:bg-off-white dark:hover:bg-zinc-200 rounded-md text-white dark:text-black shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
											title="Send message"
											aria-label="Send message"
										>
											<Send className="h-5 w-5" />
											<span className="sr-only">Send message</span>
										</Button>
									</>
								)}
							</div>
						</div>
					</div>

					<div className="mt-2 border-t border-zinc-200 px-3 pb-3 pt-3 dark:border-zinc-700">
						{autoPlayResponses?.isGenerating && (
							<div
								className="mb-3 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"
								aria-live="polite"
								role="status"
							>
								<Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" aria-hidden="true" />
								<span>Generating response audio...</span>
							</div>
						)}
						{hideDefaultControls && controls && <div>{controls}</div>}
						{!hideDefaultControls && (
							<div className="flex items-center justify-between gap-1 sm:gap-2">
								<div className="flex-1 min-w-0 max-w-[70%] sm:max-w-none flex items-center gap-2">
									<div className="min-w-0 flex-shrink">
										<ModelSelector isDisabled={isLoading} mono={true} modelScope={modelScope} />
									</div>
									<InlineResponseControls isDisabled={isLoading} />
								</div>
								<div className="flex-shrink-0 flex items-center gap-2">
									<ChatSettingsComponent
										isDisabled={isLoading}
										toolSelectionLocked={isToolSelectionLocked}
										supportsToolCalls={supportsToolCalls}
									/>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	},
);
