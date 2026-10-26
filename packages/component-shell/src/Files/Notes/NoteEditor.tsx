import {
  AIFormattingModal,
  MediaGenerationModal,
  NoteEditorSurface,
  NoteEditorToolbar,
  TranscriptionOverlay,
} from "@ngriffin_uk/polychat-component-experiences/content";
import {
  useDraftNotesFromMedia,
  useRealtimeLiveSession,
  useRealtimeProviders,
  useSpeechActivity,
  useTabAudioCapture,
  useUIStore,
  type TabInfo,
} from "@ngriffin_uk/polychat-library-react";
import { getFirstReadyRealtimeTranscriptionProviderOption } from "@ngriffin_uk/polychat-library-realtime/live-providers";
import {
  formatTextWithSpacing,
  getCharCount,
  getWordCount,
} from "@ngriffin_uk/polychat-utility-core";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAutoSave } from "./hooks/useAutoSave.js";
import { useDictationPauses } from "./hooks/useDictationPauses.js";
import { useDictationWriter } from "./hooks/useDictationWriter.js";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import { useNoteAssist } from "./hooks/useNoteAssist.js";

interface NoteEditorProps {
  noteId: string;
  initialText: string;
  canSave: boolean;
  onSave: (text: string, capturedFrom?: TabInfo) => Promise<void>;
  onTextChange?: (text: string) => void;
  renderMetadata?: (text: string) => ReactNode;
}

export function NoteEditor({
  noteId,
  initialText,
  canSave,
  onSave,
  onTextChange,
  renderMetadata,
}: NoteEditorProps) {
  const [text, setText] = useState<string>(initialText);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const reading = useUIStore((state) => state.noteReading);
  const setReading = useUIStore((state) => state.setNoteReading);
  const draftFromMedia = useDraftNotesFromMedia();
  const assist = useNoteAssist(noteId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const appliedInitialTextRef = useRef(initialText);
  const tabCapture = useTabAudioCapture();
  const capturedFrom = tabCapture.tabInfo ?? undefined;
  const saveText = useCallback(
    (value: string) => onSave(value, capturedFrom),
    [capturedFrom, onSave],
  );
  const { isSaving, forceSave } = useAutoSave({ text, onSave: saveText, enabled: canSave });
  const forceSaveRef = useRef(forceSave);

  useEffect(() => {
    forceSaveRef.current = forceSave;
  }, [forceSave]);

  useEffect(() => () => void forceSaveRef.current(), []);

  useEffect(() => {
    onTextChange?.(text);
  }, [onTextChange, text]);

  const takeParagraphBreakRef = useRef<() => boolean>(() => false);
  const takeParagraphBreakNow = useCallback(() => takeParagraphBreakRef.current(), []);
  const dictation = useDictationWriter({ setText, takeParagraphBreak: takeParagraphBreakNow });
  const { finish: finishDictation, reset: resetDictation } = dictation;

  const { data: realtimeProviders = [], isLoading: isLoadingProviders } = useRealtimeProviders();
  const transcription = useRealtimeLiveSession({
    providers: realtimeProviders,
    sessionType: "transcription",
    onTranscript: dictation.handleTranscript,
  });
  const isTranscribing = transcription.status !== "idle";
  const { isSpeechDetected, lastSilenceAt } = useSpeechActivity(
    transcription.inputAudioLevel,
    transcription.isActive,
  );
  const takeParagraphBreak = useDictationPauses({
    isActive: transcription.isActive,
    isSpeechDetected,
    lastSilenceAt,
  });

  useEffect(() => {
    takeParagraphBreakRef.current = takeParagraphBreak;
  }, [takeParagraphBreak]);

  useKeyboardShortcuts({ onSave: () => void forceSave() });

  useEffect(() => {
    const lastApplied = appliedInitialTextRef.current;

    appliedInitialTextRef.current = initialText;
    if (document.activeElement === textareaRef.current) {
      return;
    }

    setText((current) => (current === lastApplied ? initialText : current));
  }, [initialText]);

  const startTranscription = useCallback(
    (inputStream?: MediaStream) => {
      const provider = getFirstReadyRealtimeTranscriptionProviderOption(realtimeProviders);

      if (!provider) {
        toast.error(
          isLoadingProviders
            ? "Realtime providers are still loading"
            : "Set up a realtime transcription provider in provider settings first",
        );

        return false;
      }

      resetDictation();
      void transcription.start(provider.id, undefined, { inputStream });

      return true;
    },
    [isLoadingProviders, realtimeProviders, resetDictation, transcription],
  );

  const stopTranscription = useCallback(() => {
    transcription.stop();
    finishDictation();
  }, [finishDictation, transcription]);

  const handleTranscriptionToggle = useCallback(() => {
    if (isTranscribing) {
      stopTranscription();
      if (tabCapture.isCapturing) {
        tabCapture.stop();
      }
    } else {
      startTranscription();
    }
  }, [isTranscribing, startTranscription, stopTranscription, tabCapture]);

  const handleTabCaptureToggle = useCallback(async () => {
    if (tabCapture.isCapturing) {
      stopTranscription();
      tabCapture.stop();

      return;
    }

    const stream = await tabCapture.start();

    if (stream && !startTranscription(stream)) {
      tabCapture.stop();
    }
  }, [startTranscription, stopTranscription, tabCapture]);

  return (
    <NoteEditorSurface
      text={text}
      onTextChange={setText}
      textareaRef={textareaRef}
      fontFamily={reading.fontFamily}
      fontSize={reading.fontSize}
      isSaving={isSaving}
      hasMetadata={Boolean(renderMetadata)}
      metadataPanel={renderMetadata?.(text)}
    >
      <TranscriptionOverlay
        isVisible={isTranscribing}
        transcriptionStatus={transcription.status}
        isSpeechDetected={isSpeechDetected}
        lastSilenceTime={lastSilenceAt}
        partialTranscript={dictation.pending}
      />

      <NoteEditorToolbar
        fontFamily={reading.fontFamily}
        onFontFamilyChange={(fontFamily) => setReading({ fontFamily })}
        paper={reading.theme}
        onPaperChange={(theme) => setReading({ theme })}
        fontSize={reading.fontSize}
        onFontSizeChange={(fontSize) => setReading({ fontSize })}
        text={text}
        wordCount={getWordCount(text)}
        charCount={getCharCount(text)}
        canAssist={Boolean(text.trim())}
        onClearText={() => setText("")}
        onOpenMediaModal={() => setIsMediaModalOpen(true)}
        onOpenFormatModal={() => {
          void Promise.resolve(forceSave()).then(assist.open);
        }}
        isTranscribing={isTranscribing}
        transcriptionStatus={transcription.status}
        isSpeechDetected={isSpeechDetected}
        onTranscriptionToggle={handleTranscriptionToggle}
        isCapturingTab={tabCapture.isCapturing}
        onTabCaptureToggle={() => void handleTabCaptureToggle()}
      />

      <MediaGenerationModal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        onNotesGenerated={(content) =>
          setText((current) => formatTextWithSpacing(current, `\n\n${content}`))
        }
        isGenerating={draftFromMedia.isPending}
        onValidationError={(message) => toast.error(message)}
        onGenerate={async (request) => {
          try {
            const result = await draftFromMedia.mutateAsync(request);

            toast.success("Notes from the recording are in");

            return result.content;
          } catch {
            toast.error("Poly couldn't make notes from that link");

            return undefined;
          }
        }}
      />

      <AIFormattingModal
        isOpen={assist.isOpen}
        onClose={assist.close}
        aiPrompt={assist.prompt}
        setAIPrompt={assist.setPrompt}
        aiResult={assist.result}
        formatNoteMutation={{ status: assist.status }}
        runFormat={() => void assist.run()}
        onAccept={setText}
        noteId={noteId}
      />
    </NoteEditorSurface>
  );
}
