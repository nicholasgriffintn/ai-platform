import {
  File,
  Image,
  Layers,
  Mic,
  Paperclip,
  Pause,
  Send,
  Square,
  X,
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
import type { ModelConfigItem } from "~/types";
import { ChatSettings as ChatSettingsComponent } from "./ChatSettings";
import { ToolToggles } from "./ChatSettings/ToolToggles";
import { ModelSelector } from "./ModelSelector";

const MultiModelToggle = ({ isDisabled }: { isDisabled?: boolean }) => {
  const { model, chatMode, isPro, useMultiModel, setUseMultiModel } =
    useChatStore();

  if (!isPro || model !== null || chatMode !== "remote") {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 ml-1">
      <button
        type="button"
        onClick={() => setUseMultiModel(!useMultiModel)}
        disabled={isDisabled}
        className={`flex items-center gap-1 p-1.5 rounded text-xs ${
          useMultiModel
            ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-200"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        }`}
        title="Toggle multi-model mode"
        aria-pressed={useMultiModel}
      >
        <Layers className="h-3 w-3" />
        <span className="hidden sm:inline">Multi-model</span>
      </button>
    </div>
  );
};

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
    const { model, chatInput, setChatInput, isMobile } = useChatStore();
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
    const [supportsDocuments, setSupportsDocuments] = useState(false);
    const [supportsFunctions, setSupportsFunctions] = useState(false);
    const { data: apiModels } = useModels();
    const [isUploading, setIsUploading] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus();
      },
    }));

    // biome-ignore lint/correctness/useExhaustiveDependencies: This is a side effect that should only run when the input changes
    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, [chatInput]);

    useEffect(() => {
      if (!apiModels || !model) {
        setIsMultimodalModel(false);
        setSupportsDocuments(false);
        setSupportsFunctions(false);
        return;
      }

      const modelData = apiModels[model] as ModelConfigItem | undefined;

      const isMultimodal =
        modelData?.multimodal || modelData?.type?.includes("image-to-text");
      setIsMultimodalModel(!!isMultimodal);
      setSupportsDocuments(!!modelData?.supportsDocuments);
      setSupportsFunctions(!!modelData?.supportsFunctions);
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

      try {
        setIsUploading(true);

        // Handle image uploads
        if (file.type.startsWith("image/")) {
          if (!isMultimodalModel) {
            alert("This model does not support image uploads");
            setIsUploading(false);
            return;
          }

          const { url } = await apiService.uploadFile(file, "image");

          setSelectedAttachment({
            type: "image",
            data: url,
          });
          setIsUploading(false);
          return;
        }

        // Handle PDF documents
        if (file.type === "application/pdf") {
          // If model supports documents natively, upload as document
          if (supportsDocuments) {
            const { url, name } = await apiService.uploadFile(file, "document");
            setSelectedAttachment({
              type: "document",
              data: url,
              name: name || file.name,
            });
          }
          // Otherwise convert PDF to markdown
          else {
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

        // Handle all other document types - always convert to markdown
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
      let fileTypes =
        "text/html,application/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroenabled.12,application/vnd.ms-excel.sheet.binary.macroenabled.12,application/vnd.ms-excel,application/vnd.oasis.opendocument.spreadsheet,text/csv,application/vnd.apple.numbers,application/pdf";

      if (isMultimodalModel) {
        fileTypes += ",image/*";
      }

      return fileTypes;
    };

    const getUploadButtonIcon = () => {
      if (isMultimodalModel) {
        return (
          <span className="flex space-x-1">
            <Image className="h-4 w-4" />
            {supportsDocuments ? (
              <File className="h-4 w-4" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </span>
        );
      }

      if (supportsDocuments) {
        return <File className="h-4 w-4" />;
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
      return { preview: null, label: "" };
    };

    const canUploadFiles = true;

    const { preview, label } = selectedAttachment
      ? getAttachmentIconAndLabel()
      : { preview: null, label: "" };

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
                              aria-label="Upload a file"
                            />
                            <Button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isLoading || isUploading}
                              className="cursor-pointer p-1.5 hover:bg-off-white-highlight dark:hover:bg-zinc-800 rounded-md text-zinc-600 dark:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={`Upload ${isMultimodalModel ? "an Image or Document" : "a Document"}`}
                              aria-label={`Upload ${isMultimodalModel ? "an Image or Document" : "a Document"}`}
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
                            // biome-ignore lint/a11y/useSemanticElements: I don't want to use output
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
                        (!chatInput?.trim() && !selectedAttachment) ||
                        isLoading ||
                        isUploading
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
                <MultiModelToggle isDisabled={isLoading} />
                <ToolToggles isDisabled={isLoading} />
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                {!isMobile && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                    Shift+Enter for new line
                  </span>
                )}
                <ChatSettingsComponent
                  isDisabled={isLoading}
                  supportsFunctions={supportsFunctions}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
