import {
	File,
	FileText,
	Image as ImageIcon,
	Loader2,
	Paperclip,
	Pause,
	Send,
	Volume2,
	FileCode,
} from "lucide-react";
import {
	type ChangeEvent,
	type KeyboardEvent,
	type ReactNode,
	forwardRef,
	useId,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { Button, Image } from "~/components/ui";
import { useModels } from "~/hooks/useModels";
import { useVoiceRecorder } from "~/hooks/useVoiceRecorder";
import type { AttachmentData } from "~/lib/chat/attachments";
import { getModelInteractionCapabilities } from "~/lib/models";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import type { ModelSelectionChangeHandler, ModelSelectorScope } from "~/types";
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
import {
	TokenizedComposerInput,
	type ComposerInputToken,
	type ComposerInputTokenPosition,
	type TokenizedComposerInputHandle,
} from "./TokenizedComposerInput";
import { useComposerCommandController } from "./useComposerCommandController";
import { uploadComposerAttachment } from "./uploadAttachment";

export interface ChatInputHandle {
	focus: () => void;
}

interface ChatInputProps {
	handleSubmit: (attachments?: AttachmentData[]) => void;
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
		includeSettingCommands?: boolean;
		onClearActive?: () => void;
	};
	modelProviderFilter?: string;
	modelScope?: ModelSelectorScope;
	onModelChange?: ModelSelectionChangeHandler;
	disableAttachments?: boolean;
	hideDefaultControls?: boolean;
	hideComposerActionMenu?: boolean;
	hideSubmitButton?: boolean;
	hideTextInput?: boolean;
	hideInlineResponseControls?: boolean;
	hideChatSettings?: boolean;
	autoPlayResponses?: {
		enabled: boolean;
		isGenerating: boolean;
		isPlaying: boolean;
		onToggle: () => void;
	};
	contextAttachments?: AttachmentData[];
	onRemoveContextAttachment?: (index: number) => void;
	onClearContextAttachments?: () => void;
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
			modelProviderFilter,
			modelScope = "default",
			onModelChange,
			disableAttachments = false,
			hideDefaultControls = false,
			hideComposerActionMenu = false,
			hideSubmitButton = false,
			hideTextInput = false,
			hideInlineResponseControls = false,
			hideChatSettings = false,
			autoPlayResponses,
			contextAttachments = [],
			onRemoveContextAttachment,
			onClearContextAttachments,
		},
		ref,
	) => {
		const { isMobile } = useUIStore();
		const {
			model,
			chatInput,
			setChatInput,
			chatMode,
			isAuthenticationLoading,
			selectedAgentId,
			selectedAgentTokenPosition,
			selectedAssistantAction,
			setSelectedAgentTokenPosition,
			setSelectedAssistantAction,
		} = useChatStore();
		const { isPro, currentConversationId } = useChatStore();
		const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceRecorder({
			onTranscribe,
		});
		const [selectedAttachments, setSelectedAttachments] = useState<AttachmentData[]>([]);
		const { data: apiModels } = useModels();
		const [isUploading, setIsUploading] = useState(false);
		const modelCapabilities = useMemo(
			() => getModelInteractionCapabilities(model ? apiModels?.[model] : undefined),
			[apiModels, model],
		);
		const {
			isImageModel,
			isMultimodalModel,
			isTextToImageOnlyModel,
			supportsAudio,
			supportsCode,
			supportsDocuments,
			supportsToolCalls,
		} = modelCapabilities;

		const composerInputRef = useRef<TokenizedComposerInputHandle>(null);
		const fileInputRef = useRef<HTMLInputElement>(null);
		const fileInputId = useId();
		const {
			applyDirectiveSelection,
			commandState,
			directiveQuery,
			moveActiveSuggestion,
			setTextareaCursorPosition,
		} = useComposerCommandController({
			isLoading,
			modeControls: {
				...modeControls,
				includeSettingCommands: modeControls?.includeSettingCommands ?? !hideChatSettings,
			},
		});

		useImperativeHandle(
			ref,
			() => ({
				focus: () => {
					if (!hideTextInput) {
						composerInputRef.current?.focus();
					}
				},
			}),
			[hideTextInput],
		);

		const composerTokens = useMemo<ComposerInputToken[]>(() => {
			const tokens: ComposerInputToken[] = [];
			if (
				selectedAssistantAction?.item &&
				typeof selectedAssistantAction.tokenPosition === "number"
			) {
				tokens.push({
					id: `action:${selectedAssistantAction.item.id}`,
					kind: "action",
					label: selectedAssistantAction.item.label,
					position: selectedAssistantAction.tokenPosition,
				});
			}

			if (commandState.selectedAgent && typeof selectedAgentTokenPosition === "number") {
				tokens.push({
					id: `agent:${commandState.selectedAgent.id}`,
					kind: "agent",
					label: commandState.selectedAgent.name,
					position: selectedAgentTokenPosition,
				});
			}

			return tokens;
		}, [commandState.selectedAgent, selectedAgentTokenPosition, selectedAssistantAction]);
		const hasInlineAgentToken = composerTokens.some((token) => token.kind === "agent");

		const handleComposerTokenPositionsChange = (positions: ComposerInputTokenPosition[]) => {
			const nextPositions = new Map(positions.map((position) => [position.id, position.position]));
			if (selectedAssistantAction?.item) {
				const tokenId = `action:${selectedAssistantAction.item.id}`;
				const nextPosition = nextPositions.get(tokenId);
				if (typeof nextPosition === "number") {
					if (selectedAssistantAction.tokenPosition !== nextPosition) {
						setSelectedAssistantAction({
							...selectedAssistantAction,
							tokenPosition: nextPosition,
						});
					}
				} else if (typeof selectedAssistantAction.tokenPosition === "number") {
					setSelectedAssistantAction(null);
				}
			}

			if (selectedAgentId) {
				const nextPosition = nextPositions.get(`agent:${selectedAgentId}`);
				if (typeof nextPosition === "number") {
					if (selectedAgentTokenPosition !== nextPosition) {
						setSelectedAgentTokenPosition(nextPosition);
					}
				} else if (typeof selectedAgentTokenPosition === "number") {
					commandState.clearAgent();
				}
			}
		};

		const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
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
				composerInputRef.current?.getCursorPosition() === 0 &&
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
				if (isComposerSubmitDisabled) {
					return;
				}
				submitSelectedAttachments();
			}
			if (e.key === "Enter" && e.shiftKey) {
				e.preventDefault();
				const cursorPosition = composerInputRef.current?.getCursorPosition() ?? chatInput.length;
				const textBeforeCursor = chatInput.substring(0, cursorPosition);
				const textAfterCursor = chatInput.substring(cursorPosition);
				setChatInput(`${textBeforeCursor}\n${textAfterCursor}`);

				setTimeout(() => {
					composerInputRef.current?.setCursorPosition(cursorPosition + 1);
				}, 0);
			}
		};

		const handleComposerInput = (value: string) => setChatInput(value);

		const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(e.target.files ?? []);
			if (files.length === 0) {
				return;
			}

			try {
				setIsUploading(true);
				const uploadedAttachments: AttachmentData[] = [];
				const uploadResults = await Promise.allSettled(
					files.map((file) =>
						uploadComposerAttachment(file, {
							isImageModel,
							isMultimodalModel,
							isTextToImageOnlyModel,
							supportsAudio,
							supportsDocuments,
						}),
					),
				);

				for (const result of uploadResults) {
					if (result.status === "rejected") {
						alert(
							`Failed to upload file: ${result.reason instanceof Error ? result.reason.message : "Unknown error"}`,
						);
						continue;
					}

					if ("error" in result.value) {
						alert(result.value.error);
					} else {
						uploadedAttachments.push(result.value.attachment);
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

		const submitSelectedAttachments = () => {
			const combinedAttachments = [...contextAttachments, ...selectedAttachments];
			const attachments = combinedAttachments.length > 0 ? combinedAttachments : undefined;
			clearSelectedAttachments();
			onClearContextAttachments?.();
			handleSubmit(attachments);
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
				return <ImageIcon className="h-4 w-4" />;
			}
			if (isMultimodalModel || supportsAudio) {
				return (
					<span className="flex space-x-1">
						{isMultimodalModel && <ImageIcon className="h-4 w-4" />}
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
						<Image
							src={attachment.data}
							alt="Selected"
							className="h-4 w-4 rounded object-cover"
							crossOrigin="use-credentials"
						/>
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
			if (attachment.type === "artifact_selection") {
				return {
					preview: <FileText className="h-3.5 w-3.5" aria-hidden="true" />,
					label: attachment.name,
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

		const contextAttachmentChips = contextAttachments.flatMap((attachment, index) => {
			const { preview, label } = getAttachmentIconAndLabel(attachment);
			return preview
				? [
						{
							label,
							onClear: () => onRemoveContextAttachment?.(index),
							preview,
						},
					]
				: [];
		});

		const selectedAttachmentChips = selectedAttachments.flatMap((attachment, index) => {
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
		const attachmentChips = [...contextAttachmentChips, ...selectedAttachmentChips];

		const isToolSelectionLocked = chatMode === "agent" && selectedAgentId !== null;
		const canUseProComposerActions = isPro;
		const showInlineMultiModelToggle = isPro && !model && chatMode === "remote";
		const canShowToolMenu = showInlineMultiModelToggle || supportsToolCalls;
		const canShowActionMenu = canUseProComposerActions || canShowToolMenu;
		const shouldRenderInputControls = hideTextInput && controls;
		const isComposerSubmitDisabled =
			(!chatInput?.trim() && selectedAttachments.length === 0 && contextAttachments.length === 0) ||
			isLoading ||
			isUploading ||
			isAuthenticationLoading;

		return (
			<div
				data-chat-input-shell
				className="relative rounded-lg border border-zinc-200 dark:border-zinc-700 bg-off-white dark:bg-[#121212] shadow-sm hover:border-zinc-300 dark:hover:border-zinc-600 focus-within:border-zinc-300 dark:focus-within:border-zinc-500 transition-colors"
			>
				<div className="flex flex-col">
					<ComposerCommandChips
						{...commandState}
						attachments={attachmentChips}
						hideAgentChip={hasInlineAgentToken}
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
							{shouldRenderInputControls && (
								<div className="flex min-h-[60px] min-w-0 flex-grow items-center px-4 py-3">
									{controls}
								</div>
							)}
							{!hideTextInput && (
								<div data-composer-input-row className="flex min-w-0 flex-grow px-4 py-3">
									<TokenizedComposerInput
										id="message-input"
										ref={composerInputRef}
										value={chatInput}
										tokens={composerTokens}
										onChange={handleComposerInput}
										onCursorPositionChange={setTextareaCursorPosition}
										onTokenPositionsChange={handleComposerTokenPositionsChange}
										onKeyDown={handleKeyDown}
										placeholder={
											!currentConversationId
												? (placeholder?.newConversation ?? "Ask me anything...")
												: (placeholder?.followUp ?? "Ask follow-up questions...")
										}
										disabled={isRecording || isTranscribing || isLoading || isAuthenticationLoading}
										ariaLabel="Message input"
										ariaDescribedBy="message-input-help"
									/>
								</div>
							)}
							{!hideTextInput && (
								<div id="message-input-help" className="sr-only">
									Type your message and press Enter to send. Use Shift+Enter for a new line.
								</div>
							)}

							{!hideDefaultControls && (
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
											{!hideComposerActionMenu && canShowActionMenu && (
												<ComposerActionMenu
													autoPlayResponses={
														canUseProComposerActions ? autoPlayResponses : undefined
													}
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
															<ToolToggles isDisabled={isLoading || isToolSelectionLocked} />
														) : undefined
													}
													uploadIcon={getUploadButtonIcon()}
													uploadLabel={`Upload ${isMultimodalModel || supportsAudio ? "files (images, audio, documents, code)" : "a Document or Code file"}`}
												/>
											)}
											<ComposerCommandButton {...commandState} />
											{!hideSubmitButton && (
												<Button
													type="submit"
													onClick={submitSelectedAttachments}
													disabled={isComposerSubmitDisabled}
													className="cursor-pointer p-2.5 bg-black hover:bg-zinc-800 dark:bg-off-white dark:hover:bg-zinc-200 rounded-md text-white dark:text-black shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
													title="Send message"
													aria-label="Send message"
												>
													<Send className="h-5 w-5" />
													<span className="sr-only">Send message</span>
												</Button>
											)}
										</>
									)}
								</div>
							)}
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
						{hideDefaultControls && controls && !shouldRenderInputControls && <div>{controls}</div>}
						{!hideDefaultControls && (
							<div className="flex items-center justify-between gap-1 sm:gap-2">
								<div className="flex-1 min-w-0 max-w-[70%] sm:max-w-none flex items-center gap-2">
									<div className="min-w-0 flex-shrink">
										<ModelSelector
											isDisabled={isLoading}
											mono={true}
											modelProviderFilter={modelProviderFilter}
											modelScope={modelScope}
											onModelChange={onModelChange}
										/>
									</div>
									{!hideInlineResponseControls && <InlineResponseControls isDisabled={isLoading} />}
								</div>
								<div className="flex-shrink-0 flex items-center gap-2">
									{!hideChatSettings && (
										<ChatSettingsComponent
											isDisabled={isLoading}
											toolSelectionLocked={isToolSelectionLocked}
											supportsToolCalls={supportsToolCalls}
										/>
									)}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	},
);
