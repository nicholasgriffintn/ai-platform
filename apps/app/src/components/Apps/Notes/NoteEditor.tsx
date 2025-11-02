import { Hash } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AIFormattingModal } from "~/components/Apps/Notes/AIFormattingModal";
import { MediaGenerationModal } from "~/components/Apps/Notes/MediaGenerationModal";
import { NoteEditorToolbar } from "~/components/Apps/Notes/NoteEditorToolbar";
import { NoteMetadata } from "~/components/Apps/Notes/NoteMetadata";
import { TranscriptionOverlay } from "~/components/Apps/Notes/TranscriptionOverlay";
import { useAutoSave } from "~/components/Apps/Notes/hooks/useAutoSave";
import { useKeyboardShortcuts } from "~/components/Apps/Notes/hooks/useKeyboardShortcuts";
import { useNoteFormatter } from "~/hooks/useNoteFormatter";
import { useTabAudioCapture } from "~/hooks/useTabAudioCapture";
import { useTranscription } from "~/hooks/useTranscription";
import {
	formatTextWithSpacing,
	getCharCount,
	getWordCount,
} from "~/lib/text-utils";
import { cn } from "~/lib/utils";

interface NoteEditorProps {
	noteId?: string;
	initialText?: string;
	initialMetadata?: Record<string, any>;
	onSave: (
		title: string,
		content: string,
		metadata?: Record<string, any>,
	) => Promise<string>;
	onDelete?: () => Promise<void>;
	onToggleFullBleed?: () => void;
	isFullBleed?: boolean;
	initialThemeMode?: string;
	onThemeChange?: (mode: string) => void;
	initialFontFamily?: string;
	onFontFamilyChange?: (fontFamily: string) => void;
	initialFontSize?: number;
	onFontSizeChange?: (fontSize: number) => void;
}

export function NoteEditor({
	noteId,
	initialText = "",
	initialMetadata,
	onSave,
	onDelete,
	onToggleFullBleed,
	isFullBleed = false,
	initialThemeMode = "sepia",
	onThemeChange,
	initialFontFamily = "Sans",
	onFontFamilyChange,
	initialFontSize = 25,
	onFontSizeChange,
}: NoteEditorProps) {
	const [text, setText] = useState<string>(initialText);
	const [fontFamily, setFontFamily] = useState<string>(initialFontFamily);
	const [themeMode, setThemeMode] = useState<string>(initialThemeMode);
	const [fontSize, setFontSize] = useState<number>(initialFontSize);
	const [partialTranscript, setPartialTranscript] = useState<string>("");
	const [isSpeechDetected, setIsSpeechDetected] = useState<boolean>(false);
	const [lastSilenceTime, setLastSilenceTime] = useState<number>(0);
	const [currentMetadata, setCurrentMetadata] = useState<Record<string, any>>(
		initialMetadata || {},
	);
	const [showMetadata, setShowMetadata] = useState<boolean>(false);
	const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

	const tabCapture = useTabAudioCapture();

	const { isSaving, forceSave } = useAutoSave({
		text,
		onSave,
		tabInfo: tabCapture.tabInfo,
		metadata: currentMetadata,
	});

	const {
		isAIModalOpen,
		setIsAIModalOpen,
		aiPrompt,
		setAIPrompt,
		aiResult,
		formatNoteMutation,
		runFormat,
		openFormatModal,
	} = useNoteFormatter(noteId ?? "");

	const handleMetadataUpdate = useCallback(
		async (newMetadata: Record<string, any>) => {
			setCurrentMetadata(newMetadata);
			if (noteId) {
				forceSave();
			}
		},
		[noteId, forceSave],
	);

	const handleTranscriptionReceived = useCallback(
		(newText: string, isPartial?: boolean) => {
			if (isPartial) {
				setPartialTranscript((prev) => formatTextWithSpacing(prev, newText));
			} else {
				setPartialTranscript("");
				setText((prev) => formatTextWithSpacing(prev, newText));
			}
		},
		[],
	);

	const handleSpeechDetected = useCallback((isActive: boolean) => {
		setIsSpeechDetected(isActive);
		if (!isActive) {
			setLastSilenceTime(Date.now());
		} else {
			setLastSilenceTime(0);
		}
	}, []);

	const {
		isTranscribing,
		status: transcriptionStatus,
		startTranscription,
		stopTranscription,
	} = useTranscription({
		onTranscriptionReceived: handleTranscriptionReceived,
		onSpeechDetected: handleSpeechDetected,
	});

	useKeyboardShortcuts({
		onSave: forceSave,
		onToggleFullBleed,
		isFullBleed,
	});

	const wordCount = getWordCount(text);
	const charCount = getCharCount(text);

	useEffect(() => {
		setText(initialText);
	}, [initialText]);

	useEffect(() => {
		setThemeMode(initialThemeMode);
	}, [initialThemeMode]);

	useEffect(() => {
		setFontFamily(initialFontFamily);
	}, [initialFontFamily]);

	useEffect(() => {
		setFontSize(initialFontSize);
	}, [initialFontSize]);

	const handleFontFamilyChange = useCallback(
		(value: string) => {
			setFontFamily(value);
			onFontFamilyChange?.(value);
		},
		[onFontFamilyChange],
	);

	const handleThemeChange = useCallback(
		(value: string) => {
			setThemeMode(value);
			onThemeChange?.(value);
		},
		[onThemeChange],
	);

	const handleFontSizeChange = useCallback(
		(value: number) => {
			setFontSize(value);
			onFontSizeChange?.(value);
		},
		[onFontSizeChange],
	);

	const handleTranscriptionToggle = useCallback(() => {
		if (isTranscribing) {
			stopTranscription(true);
			setPartialTranscript("");
			setIsSpeechDetected(false);
			setLastSilenceTime(0);
		} else {
			startTranscription();
		}
	}, [isTranscribing, stopTranscription, startTranscription]);

	const handleTabCaptureToggle = useCallback(async () => {
		if (tabCapture.isCapturing) {
			stopTranscription(true);
			tabCapture.stop();
			setPartialTranscript("");
			setIsSpeechDetected(false);
			setLastSilenceTime(0);
		} else {
			const stream = await tabCapture.start();
			if (stream) {
				startTranscription(stream);
			}
		}
	}, [tabCapture, stopTranscription, startTranscription]);

	const handleNotesGenerated = useCallback((content: string) => {
		setText((prev) => formatTextWithSpacing(prev, `\n\n${content}`));
	}, []);

	const handleAIAccept = useCallback((result: string) => {
		setText(result);
	}, []);

	const handleClearText = useCallback(() => {
		setText("");
	}, []);

	return (
		<div className="relative flex flex-col flex-1 h-full">
			<output aria-live="polite" className="absolute top-4 right-4 z-20">
				<div
					className={cn(
						"w-2 h-2 sm:w-3 sm:h-3 rounded-full",
						isSaving
							? "bg-blue-400 dark:bg-blue-600 animate-pulse ring-2 ring-blue-300 dark:ring-blue-500"
							: "bg-gray-400 dark:bg-gray-600 ring-1 ring-gray-300 dark:ring-gray-500",
					)}
					title={isSaving ? "Saving..." : "All changes saved"}
				/>
				<span className="sr-only">
					{isSaving ? "Saving..." : "All changes saved"}
				</span>
			</output>

			{currentMetadata && Object.keys(currentMetadata).length > 0 && (
				<div className="border-b">
					<div className="px-4 py-2">
						<button
							type="button"
							onClick={() => setShowMetadata(!showMetadata)}
							className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black-800 dark:hover:text-black-200"
						>
							<Hash size={14} />
							Metadata
							<span className="text-xs">
								({showMetadata ? "hide" : "show"})
							</span>
						</button>
					</div>
					{showMetadata && (
						<div className="px-4 pb-4">
							<NoteMetadata
								metadata={currentMetadata}
								onMetadataUpdate={handleMetadataUpdate}
								isEditable={!!noteId}
							/>
						</div>
					)}
				</div>
			)}
			<textarea
				value={text}
				onChange={(e) => setText(e.target.value)}
				placeholder="Start typing..."
				className={cn(
					"flex-1 w-full p-4 focus:outline-none resize-none",
					fontFamily === "serif" ? "font-serif" : "font-sans",
				)}
				style={{ fontSize: `${fontSize}px` }}
			/>

			<TranscriptionOverlay
				isVisible={isTranscribing}
				transcriptionStatus={transcriptionStatus}
				isSpeechDetected={isSpeechDetected}
				lastSilenceTime={lastSilenceTime}
				partialTranscript={partialTranscript}
			/>

			<NoteEditorToolbar
				fontFamily={fontFamily}
				onFontFamilyChange={handleFontFamilyChange}
				themeMode={themeMode}
				onThemeChange={handleThemeChange}
				fontSize={fontSize}
				onFontSizeChange={handleFontSizeChange}
				text={text}
				wordCount={wordCount}
				charCount={charCount}
				noteId={noteId}
				onDelete={onDelete}
				onClearText={handleClearText}
				onToggleFullBleed={onToggleFullBleed}
				isFullBleed={isFullBleed}
				onOpenMediaModal={() => setIsMediaModalOpen(true)}
				onOpenFormatModal={openFormatModal}
				isTranscribing={isTranscribing}
				transcriptionStatus={transcriptionStatus}
				isSpeechDetected={isSpeechDetected}
				onTranscriptionToggle={handleTranscriptionToggle}
				tabCapture={tabCapture}
				onTabCaptureToggle={handleTabCaptureToggle}
			/>

			<MediaGenerationModal
				isOpen={isMediaModalOpen}
				onClose={() => setIsMediaModalOpen(false)}
				onNotesGenerated={handleNotesGenerated}
			/>

			<AIFormattingModal
				isOpen={isAIModalOpen}
				onClose={() => setIsAIModalOpen(false)}
				aiPrompt={aiPrompt}
				setAIPrompt={setAIPrompt}
				aiResult={aiResult}
				formatNoteMutation={formatNoteMutation}
				runFormat={runFormat}
				onAccept={handleAIAccept}
				noteId={noteId}
			/>
		</div>
	);
}
