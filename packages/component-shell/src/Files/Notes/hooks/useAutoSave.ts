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
  const isSavingRef = useRef(false);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    lastSavedRef.current = lastSavedText;
  }, [lastSavedText]);

  const save = useCallback(
    async (textToSave: string) => {
      if (isSavingRef.current) {
        return;
      }

      isSavingRef.current = true;
      setIsSaving(true);

      try {
        await onSave(textToSave);
        setLastSavedText(textToSave);
        setFailedText(null);
      } catch {
        setFailedText(textToSave);
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    },
    [onSave],
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
