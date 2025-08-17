import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { splitTitleAndContent } from "~/lib/text-utils";

interface UseAutoSaveOptions {
  text: string;
  onSave: (
    title: string,
    content: string,
    metadata?: Record<string, any>,
  ) => Promise<string>;
  tabInfo?: any;
  metadata: Record<string, any>;
  delay?: number;
}

export function useAutoSave({
  text,
  onSave,
  tabInfo,
  metadata,
  delay = 1000,
}: UseAutoSaveOptions) {
  const [lastSavedText, setLastSavedText] = useState<string>(text);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const textRef = useRef(text);
  const lastSavedRef = useRef(lastSavedText);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    lastSavedRef.current = lastSavedText;
  }, [lastSavedText]);

  useEffect(() => {
    setLastSavedText(text);
  }, [text]);

  const saveNote = useCallback(
    async (textToSave: string) => {
      setIsSaving(true);
      try {
        const [title, content] = splitTitleAndContent(textToSave);
        const tabMetadata = tabInfo ? { tabSource: tabInfo } : {};
        const finalMetadata = { ...metadata, ...tabMetadata };
        await onSave(title, content, finalMetadata);
        setLastSavedText(textToSave);
      } catch {
        toast.error("Failed to save note");
      } finally {
        setIsSaving(false);
      }
    },
    [onSave, tabInfo, metadata],
  );

  const forceSave = useCallback(() => {
    if (textRef.current !== lastSavedRef.current) {
      return saveNote(textRef.current);
    }
  }, [saveNote]);

  useEffect(() => {
    if (text === lastSavedText) return;
    const timeout = setTimeout(() => {
      saveNote(text);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, lastSavedText, saveNote, delay]);

  return {
    isSaving,
    lastSavedText,
    forceSave,
  };
}
