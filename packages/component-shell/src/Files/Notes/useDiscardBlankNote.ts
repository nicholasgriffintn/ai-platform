import { useSourceMutations } from "@ngriffin_uk/polychat-library-react";
import type { Source } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useRef } from "react";

import { isBlankNewNote } from "./note-text.js";

export function useDiscardBlankNote(source: Source | undefined) {
  const { deleteSource } = useSourceMutations();
  const sourceRef = useRef(source);
  const textRef = useRef("");
  const deleteRef = useRef(deleteSource.mutate);

  useEffect(() => {
    sourceRef.current = source;
    deleteRef.current = deleteSource.mutate;
  });

  useEffect(
    () => () => {
      const latest = sourceRef.current;

      if (latest && isBlankNewNote(latest) && !textRef.current.trim()) {
        deleteRef.current(latest.id);
      }
    },
    [],
  );

  return (text: string) => {
    textRef.current = text;
  };
}
