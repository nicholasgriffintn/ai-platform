import {
  AIFormattingModal,
  NoteEditorSurface,
  NoteEditorToolbar,
  NoteMetadata,
  TranscriptionOverlay,
  MediaGenerationModal,
} from "@ngriffin_uk/polychat-component-experiences/content";
import type { NoteMetadata as NoteMetadataType } from "@ngriffin_uk/polychat-schemas";
import {
  formatTextWithSpacing,
  getCharCount,
  getWordCount,
} from "@ngriffin_uk/polychat-utility-core";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAutoSave } from "~/components/Apps/Notes/hooks/useAutoSave";
import { useKeyboardShortcuts } from "~/components/Apps/Notes/hooks/useKeyboardShortcuts";
import { useNoteFormatter } from "~/hooks/useNoteFormatter";
import { useGenerateNotesFromMedia } from "~/hooks/useNotes";
import { useTabAudioCapture } from "~/hooks/useTabAudioCapture";
import { useTranscription } from "~/hooks/useTranscription";

interface NoteEditorProps {
  noteId?: string;
  projectId?: string;
  initialText?: string;
  initialMetadata?: NoteMetadataType;
  onSave: (
    title: string,
    content: string,
    metadata?: NoteMetadataType,
    options?: { refreshMetadata?: boolean },
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
  projectId,
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
  const [currentMetadata, setCurrentMetadata] = useState<NoteMetadataType>(initialMetadata || {});
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const generateNotesFromMedia = useGenerateNotesFromMedia();
  const [isMetadataRefreshing, setIsMetadataRefreshing] = useState(false);
  const saveOptionsRef = useRef<{ refreshMetadata?: boolean } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const appliedInitialTextRef = useRef(initialText);

  const tabCapture = useTabAudioCapture();

  const { isSaving, forceSave } = useAutoSave({
    text,
    onSave,
    tabInfo: tabCapture.tabInfo ?? undefined,
    metadata: currentMetadata,
    saveOptionsRef,
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
  } = useNoteFormatter(noteId ?? "", projectId);

  const handleMetadataUpdate = useCallback(
    async (newMetadata: NoteMetadataType) => {
      setCurrentMetadata(newMetadata);
      if (noteId) {
        forceSave({ bypassDirtyCheck: true });
      }
    },
    [noteId, forceSave],
  );

  const handleMetadataRegenerate = useCallback(() => {
    if (!noteId) {
      return;
    }

    saveOptionsRef.current = { refreshMetadata: true };
    setIsMetadataRefreshing(true);
    const maybePromise = forceSave({ bypassDirtyCheck: true });

    if (maybePromise?.finally) {
      maybePromise.finally(() => {
        setIsMetadataRefreshing(false);
      });
    } else {
      setIsMetadataRefreshing(false);
    }
  }, [noteId, forceSave]);

  const handleTranscriptionReceived = useCallback((newText: string, isPartial?: boolean) => {
    if (isPartial) {
      setPartialTranscript((prev) => formatTextWithSpacing(prev, newText));
    } else {
      setPartialTranscript("");
      setText((prev) => formatTextWithSpacing(prev, newText));
    }
  }, []);

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
    const lastApplied = appliedInitialTextRef.current;

    appliedInitialTextRef.current = initialText;
    if (document.activeElement === textareaRef.current) {
      return;
    }

    setText((current) => (current === lastApplied ? initialText : current));
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

  useEffect(() => {
    setCurrentMetadata(initialMetadata || {});
  }, [initialMetadata]);

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
    <NoteEditorSurface
      text={text}
      onTextChange={setText}
      textareaRef={textareaRef}
      fontFamily={fontFamily}
      fontSize={fontSize}
      isSaving={isSaving}
      hasMetadata={!!currentMetadata && Object.keys(currentMetadata).length > 0}
      metadataPanel={
        currentMetadata ? (
          <NoteMetadata
            metadata={currentMetadata}
            onMetadataUpdate={handleMetadataUpdate}
            isEditable={!!noteId}
            canRegenerate={!!noteId}
            onRegenerateMetadata={handleMetadataRegenerate}
            isRegeneratingMetadata={isMetadataRefreshing}
          />
        ) : null
      }
    >
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
        isGenerating={generateNotesFromMedia.status === "pending"}
        onValidationError={(message) => toast.error(message)}
        onGenerate={async (request) => {
          try {
            const result = await generateNotesFromMedia.mutateAsync(request);

            toast.success("Generated notes added to editor");

            return result.content;
          } catch {
            toast.error("Failed to generate notes from URL");

            return undefined;
          }
        }}
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
    </NoteEditorSurface>
  );
}
