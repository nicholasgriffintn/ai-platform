import {
	File,
	Image,
	Mic,
	Paperclip,
	Pause,
	Send,
	Square,
	Volume2,
	X,
	FileCode,
} from "lucide-react";
import {
	type ChangeEvent,
	type FormEvent,
	type KeyboardEvent,
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";

import { Button } from "~/components/ui";
import { useModels } from "~/hooks/useModels";
import { useVoiceRecorder } from "~/hooks/useVoiceRecorder";
import { apiService } from "~/lib/api/api-service";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import type { ModelConfigItem } from "~/types";
import { ChatSettings as ChatSettingsComponent } from "./ChatSettings";
import { ToolToggles } from "./ChatSettings/ToolToggles";
import { ModelSelector } from "./ModelSelector";

export interface ChatInputHandle {
	focus: () => void;
}

interface ChatInputProps {
	handleSubmit: (
		e: FormEvent,
		attachmentData?: { type: string; data: string; name?: string },
	) => void;
	isLoading: boolean;
	streamStarted: boolean;
	controller: AbortController;
	onTranscribe: (data: { response: { content: string } }) => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
	(
		{ handleSubmit, isLoading, streamStarted, controller, onTranscribe },
		ref,
	) => {
		const { isMobile } = useUIStore();
		const { model, chatInput, setChatInput, chatMode, selectedAgentId } =
			useChatStore();
		const { isPro, currentConversationId } = useChatStore();
		const { isRecording, isTranscribing, startRecording, stopRecording } =
			useVoiceRecorder({ onTranscribe });
		const [selectedAttachment, setSelectedAttachment] = useState<{
			type: string;
			data: string;
			name?: string;
			markdown?: string;
		} | null>(null);
		const [isMultimodalModel, setIsMultimodalModel] = useState(false);
		const [isImageModel, setIsImageModel] = useState(false);
		const [isTextToImageOnlyModel, setIsTextToImageOnlyModel] = useState(false);
		const [supportsDocuments, setSupportsDocuments] = useState(false);
		const [supportsAudio, setSupportsAudio] = useState(false);
		const [supportsCode, setSupportsCode] = useState(false);
		const [supportsToolCalls, setsupportsToolCalls] = useState(false);
		const { data: apiModels } = useModels();
		const [isUploading, setIsUploading] = useState(false);

		const textareaRef = useRef<HTMLTextAreaElement>(null);
		const fileInputRef = useRef<HTMLInputElement>(null);

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
				return;
			}

			const modelData = apiModels[model] as ModelConfigItem | undefined;

			const inputs = modelData?.modalities?.input ?? ["text"];
			const outputs = modelData?.modalities?.output ?? inputs;
			const hasTextToImage =
				outputs.includes("image") &&
				!outputs.includes("text") &&
				!inputs.includes("image");
			const hasImageToImage =
				outputs.includes("image") && inputs.includes("image");
			const hasImageToText =
				outputs.includes("text") && inputs.includes("image");
			const multimodal = !!modelData?.multimodal || hasImageToText;
			setIsMultimodalModel(multimodal);
			const textOnlyToImage =
				hasTextToImage && !hasImageToImage && !hasImageToText;
			setIsTextToImageOnlyModel(textOnlyToImage);
			const imageOnly = hasImageToImage || hasImageToText;
			setIsImageModel(imageOnly);
			setSupportsDocuments(
				!!modelData?.supportsDocuments && !imageOnly && !textOnlyToImage,
			);
			setSupportsAudio(
				!!modelData?.supportsAudio && !imageOnly && !textOnlyToImage,
			);
			setSupportsCode(
				!!modelData?.supportsDocuments && !imageOnly && !textOnlyToImage,
			);
			setsupportsToolCalls(!!modelData?.supportsToolCalls);
		}, [model, apiModels]);

		const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (isMobile && e.key === "Enter") {
				return;
			}

			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				clearSelectedAttachment();
				handleSubmit(
					e as unknown as FormEvent,
					selectedAttachment || undefined,
				);
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
						textarea.selectionStart = textarea.selectionEnd =
							cursorPosition + 1;
					}, 0);
				}
			}
		};

		const handleTextAreaInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
			setChatInput(e.target.value);
		};

		const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;
			if (isTextToImageOnlyModel) {
				alert("This model does not support file uploads");
				return;
			}
			if (isImageModel && !file.type.startsWith("image/")) {
				alert("This model only supports image uploads");
				return;
			}

			try {
				setIsUploading(true);

				if (file.type.startsWith("image/")) {
					if (!isMultimodalModel && !isImageModel) {
						alert("This model does not support image uploads");
						setIsUploading(false);
						return;
					}

					const { url } = await apiService.uploadFile(file, "image");

					setSelectedAttachment({
						type: "image",
						data: url,
						name: file.name,
					});
					setIsUploading(false);
					return;
				}

				if (file.type.startsWith("audio/")) {
					if (!supportsAudio) {
						alert("This model does not support audio uploads");
						setIsUploading(false);
						return;
					}

					const { url } = await apiService.uploadFile(file, "audio");

					setSelectedAttachment({
						type: "audio",
						data: url,
						name: file.name,
					});
					setIsUploading(false);
					return;
				}

				const codeLike =
					file.type.startsWith("text/") ||
					file.type === "application/javascript" ||
					file.type === "application/typescript" ||
					file.name.match(
						/\.(ts|tsx|js|jsx|json|py|go|java|rb|php|rs|cs|kt|swift|scala|sh|yml|yaml|sql|toml|c|cc|cpp|cxx|hpp|h)$/i,
					);

				if (codeLike) {
					const { url, name, markdown, type } = await apiService.uploadFile(
						file,
						"code",
					);

					if (type === "markdown_document" && markdown) {
						setSelectedAttachment({
							type: "markdown_document",
							data: url,
							name: name || file.name,
							markdown: markdown,
						});
						setIsUploading(false);
						return;
					}
				}

				if (file.type === "application/pdf") {
					if (supportsDocuments) {
						const { url, name } = await apiService.uploadFile(file, "document");
						setSelectedAttachment({
							type: "document",
							data: url,
							name: name || file.name,
						});
					} else {
						const { url, name, markdown, type } = await apiService.uploadFile(
							file,
							"document",
							{ convertToMarkdown: true },
						);

						if (type === "markdown_document" && markdown) {
							setSelectedAttachment({
								type: "markdown_document",
								data: url,
								name: name || file.name,
								markdown: markdown,
							});
						} else {
							alert(
								"This model does not support document uploads and conversion failed",
							);
						}
					}
					setIsUploading(false);
					return;
				}

				const { url, name, markdown, type } = await apiService.uploadFile(
					file,
					"document",
					{ convertToMarkdown: true },
				);

				if (type === "markdown_document" && markdown) {
					setSelectedAttachment({
						type: "markdown_document",
						data: url,
						name: name || file.name,
						markdown: markdown,
					});
				} else {
					alert("Unsupported file type or conversion failed");
				}
			} catch (error) {
				console.error("Failed to upload file:", error);
				alert(
					`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			} finally {
				setIsUploading(false);
			}
		};

		const clearSelectedAttachment = () => {
			setSelectedAttachment(null);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		};

		const handleFormSubmit = (e: FormEvent) => {
			clearSelectedAttachment();
			handleSubmit(e, selectedAttachment || undefined);
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
						{!supportsDocuments && !supportsAudio && (
							<Paperclip className="h-4 w-4" />
						)}
					</span>
				);
			}
			if (supportsDocuments) {
				return supportsCode ? (
					<FileCode className="h-4 w-4" />
				) : (
					<File className="h-4 w-4" />
				);
			}

			return <Paperclip className="h-4 w-4" />;
		};

		const getAttachmentIconAndLabel = () => {
			if (selectedAttachment?.type === "image") {
				return {
					preview: (
						<img
							src={selectedAttachment.data}
							alt="Selected"
							className="h-6 w-6 rounded object-cover"
						/>
					),
					label: "Image attached",
				};
			}
			if (
				selectedAttachment?.type === "document" ||
				selectedAttachment?.type === "markdown_document"
			) {
				return {
					preview: (
						<File className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
					),
					label:
						selectedAttachment?.type === "markdown_document"
							? `${selectedAttachment.name || "Document"} (converted to text)`
							: selectedAttachment.name || "Document attached",
				};
			}
			if (selectedAttachment?.type === "audio") {
				return {
					preview: (
						<Volume2 className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
					),
					label: selectedAttachment.name || "Audio attached",
				};
			}
			return { preview: null, label: "" };
		};

		const canUploadFiles = !isTextToImageOnlyModel;

		const { preview, label } = selectedAttachment
			? getAttachmentIconAndLabel()
			: { preview: null, label: "" };

		const isToolSelectionLocked =
			chatMode === "agent" && selectedAgentId !== null;

		return (
			<div className="relative rounded-lg border border-zinc-200 dark:border-zinc-700 bg-off-white dark:bg-[#121212] shadow-sm hover:border-zinc-300 dark:hover:border-zinc-600 focus-within:border-zinc-300 dark:focus-within:border-zinc-500 transition-colors">
				<div className="flex flex-col">
					{selectedAttachment && (
						<div className="px-3 pt-3">
							<div className="relative inline-flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-md p-1.5 border border-zinc-200 dark:border-zinc-700">
								{preview}
								<span className="text-xs text-zinc-600 dark:text-zinc-400">
									{label}
								</span>
								<Button
									type="button"
									onClick={clearSelectedAttachment}
									variant="icon"
									className="ml-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
									title="Remove attachment"
									aria-label="Remove attachment"
								>
									<X size={14} />
								</Button>
							</div>
						</div>
					)}
					<div className="relative">
						<div className="flex items-start">
							<textarea
								id="message-input"
								ref={textareaRef}
								value={chatInput}
								onChange={handleTextAreaInput}
								onKeyDown={handleKeyDown}
								placeholder={
									!currentConversationId
										? "Ask me anything..."
										: "Ask follow-up questions..."
								}
								disabled={isRecording || isTranscribing || isLoading}
								className="flex-grow px-4 py-3 text-base bg-transparent resize-none focus:outline-none dark:text-white min-h-[60px] max-h-[200px]"
								rows={1}
								aria-label="Message input"
								aria-describedby="message-input-help"
							/>
							<div id="message-input-help" className="sr-only">
								Type your message and press Enter to send. Use Shift+Enter for a
								new line.
							</div>

							<div className="flex-shrink-0 flex items-center gap-1 pr-3 pt-3">
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
										{isPro && (
											<div className="flex items-center gap-1 mr-2">
												{canUploadFiles && (
													<>
														<input
															type="file"
															ref={fileInputRef}
															accept={getFileTypeAccept()}
															onChange={handleFileUpload}
															className="hidden"
															id="file-upload"
															aria-label="Upload a file (images, documents, audio, and code)"
														/>
														<Button
															type="button"
															onClick={() => fileInputRef.current?.click()}
															disabled={isLoading || isUploading}
															className="cursor-pointer p-1.5 hover:bg-off-white-highlight dark:hover:bg-zinc-800 rounded-md text-zinc-600 dark:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed"
															title={`Upload ${isMultimodalModel || supportsAudio ? "files (images, audio, documents, code)" : "a Document or Code file"}`}
															aria-label={`Upload ${isMultimodalModel || supportsAudio ? "files (images, audio, documents, code)" : "a Document or Code file"}`}
															variant="icon"
															aria-haspopup="dialog"
															aria-controls="file-upload"
														>
															{isUploading ? (
																<div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 dark:border-zinc-400 border-t-transparent" />
															) : (
																getUploadButtonIcon()
															)}
														</Button>
													</>
												)}
												{isRecording ? (
													<Button
														type="button"
														onClick={stopRecording}
														disabled={isLoading}
														className="cursor-pointer p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md text-red-600 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
														title="Stop Recording"
														aria-label="Stop Recording"
														variant="icon"
													>
														<Square className="h-4 w-4" />
													</Button>
												) : isTranscribing ? (
													<div
														className="p-2 text-zinc-600 dark:text-zinc-400"
														aria-live="polite"
														role="status"
													>
														<div
															className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 dark:border-zinc-400 border-t-transparent"
															aria-hidden="true"
														/>
														<span className="sr-only">
															Transcribing voice input...
														</span>
													</div>
												) : (
													<Button
														type="button"
														onClick={startRecording}
														disabled={isLoading}
														className="cursor-pointer p-1.5 hover:bg-off-white-highlight dark:hover:bg-zinc-800 rounded-md text-zinc-600 dark:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed"
														title="Start Recording"
														aria-label="Start Recording"
														variant="icon"
													>
														<Mic className="h-4 w-4" />
													</Button>
												)}
											</div>
										)}

										<Button
											type="submit"
											onClick={handleFormSubmit}
											disabled={
												!!(
													(!chatInput?.trim() && !selectedAttachment) ||
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

					<div className="border-t border-zinc-200 dark:border-zinc-700 mt-2 px-3 pb-3 pt-3">
						<div className="flex items-center justify-between gap-1 sm:gap-2">
							<div className="flex-1 min-w-0 max-w-[70%] sm:max-w-none flex items-center gap-2">
								<div className="min-w-0 flex-shrink">
									<ModelSelector isDisabled={isLoading} mono={true} />
								</div>
								<ToolToggles isDisabled={isLoading || isToolSelectionLocked} />
							</div>
							<div className="flex-shrink-0 flex items-center gap-2">
								{!isMobile && (
									<span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:inline">
										Shift+Enter for new line
									</span>
								)}
								<ChatSettingsComponent
									isDisabled={isLoading}
									toolSelectionLocked={isToolSelectionLocked}
									supportsToolCalls={supportsToolCalls}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	},
);
