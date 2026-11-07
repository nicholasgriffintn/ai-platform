import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoSaveOptions {
  text: string;
  onSave: (text: string) => Promise<void>;
  enabled: boolean;
  delay?: number;
}

export function useAutoSave({ text, onSave, enabled, delay = 1000 }: UseAutoSaveOptions) {
  const [lastSavedText, setLastSavedText] = useState<string>(text);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [failedText, setFailedText] = useState<string | null>(null);
  const textRef = useRef(text);
  const lastSavedRef = useRef(lastSavedText);
  const queuedTextRef = useRef<string | null>(null);
  const savingTextRef = useRef<string | null>(null);
  const drainRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    lastSavedRef.current = lastSavedText;
  }, [lastSavedText]);

  const drainSaves = useCallback(async () => {
    setIsSaving(true);

    while (queuedTextRef.current !== null) {
      const textToSave = queuedTextRef.current;

      queuedTextRef.current = null;
      savingTextRef.current = textToSave;

      try {
        await onSave(textToSave);
        lastSavedRef.current = textToSave;
        setLastSavedText(textToSave);
        setFailedText(null);
      } catch {
        setFailedText(textToSave);
      }
    }

    savingTextRef.current = null;
    drainRef.current = null;
    setIsSaving(false);
  }, [onSave]);

  const save = useCallback(
    (textToSave: string) => {
      if (textToSave !== savingTextRef.current) {
        queuedTextRef.current = textToSave;
      }

      drainRef.current ??= drainSaves();

      return drainRef.current;
    },
    [drainSaves],
  );

  const forceSave = useCallback(() => {
    if (textRef.current !== lastSavedRef.current) {
      return save(textRef.current);
    }

    return undefined;
  }, [save]);

  useEffect(() => {
    if (!enabled || isSaving || text === lastSavedText || text === failedText) {
      return undefined;
    }

    const timeout = setTimeout(() => void save(text), delay);

    return () => clearTimeout(timeout);
  }, [text, lastSavedText, failedText, delay, save, enabled, isSaving]);

  return {
    isSaving,
    isDirty: text !== lastSavedText,
    hasFailed: failedText !== null && failedText === text,
    forceSave,
  };
}
