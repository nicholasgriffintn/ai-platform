import { useState } from "react";
import { toast } from "sonner";

import { useFormatNote } from "./useNotes";

export function useNoteFormatter(noteId: string) {
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiPrompt, setAIPrompt] = useState<string>("");
  const [aiResult, setAIResult] = useState<string>("");
  const formatNoteMutation = useFormatNote(noteId);

  const runFormat = async () => {
    formatNoteMutation.reset();
    setAIResult("");
    try {
      const content = await formatNoteMutation.mutateAsync(aiPrompt);
      setAIResult(content);
    } catch {
      toast.error("Failed to format note");
    }
  };

  const openFormatModal = () => {
    if (!noteId) return;
    formatNoteMutation.reset();
    setAIResult("");
    setAIPrompt("");
    setIsAIModalOpen(true);
  };

  return {
    isAIModalOpen,
    setIsAIModalOpen,
    aiPrompt,
    setAIPrompt,
    aiResult,
    formatNoteMutation,
    runFormat,
    openFormatModal,
  };
}
