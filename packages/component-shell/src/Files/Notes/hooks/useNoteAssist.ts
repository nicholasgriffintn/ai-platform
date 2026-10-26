import { useSourceEditing } from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { toast } from "sonner";

export function useNoteAssist(sourceId: string) {
  const { format } = useSourceEditing(sourceId);
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");

  return {
    isOpen,
    close: () => setIsOpen(false),
    open: () => {
      format.reset();
      setResult("");
      setPrompt("");
      setIsOpen(true);
    },
    prompt,
    setPrompt,
    result,
    status: format.status,
    run: async () => {
      format.reset();
      setResult("");

      try {
        setResult(await format.mutateAsync(prompt.trim() || undefined));
      } catch (error) {
        toast.error(getErrorMessage(error, "Poly couldn't rework this note"));
      }
    },
  };
}
