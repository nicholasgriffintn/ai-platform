import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { isConflictError } from "@ngriffin_uk/polychat-library-client";
import {
  type TabInfo,
  useSource,
  useSourceEditing,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import { readSourceDocumentMetadata, type Source } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { noteEditorText, splitNoteText } from "./note-text.js";
import { NoteEditor } from "./NoteEditor.js";
import { NoteMetadataPanel } from "./NoteMetadataPanel.js";

function newEditSession(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function NoteStage({
  source,
  onTextChange,
}: {
  source: Source;
  onTextChange?: (text: string) => void;
}) {
  const { save } = useSourceEditing(source.id);
  const { refetch } = useSource(source.id);
  const theme = useUIStore((state) => state.noteReading.theme);
  const [editSession] = useState(newEditSession);
  const [conflict, setConflict] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const revisionRef = useRef(source.revision);
  const latestTextRef = useRef(noteEditorText(source));
  const syncedTextRef = useRef(noteEditorText(source));
  const suppressSavesRef = useRef(false);
  const sourceRef = useRef(source);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    suppressSavesRef.current = false;
  }, [editorKey]);

  useEffect(() => {
    if (source.revision === revisionRef.current) {
      return;
    }

    if (latestTextRef.current === syncedTextRef.current) {
      revisionRef.current = source.revision;
      syncedTextRef.current = noteEditorText(source);
      suppressSavesRef.current = true;
      setEditorKey((key) => key + 1);
    }
  }, [source]);

  const saveText = useCallback(
    async (text: string, capturedFrom?: TabInfo) => {
      if (suppressSavesRef.current) {
        return;
      }

      const document = readSourceDocumentMetadata(sourceRef.current.metadata);

      try {
        const saved = await save.mutateAsync({
          ...splitNoteText(text),
          expectedRevision: revisionRef.current,
          editSession,
          ...(capturedFrom && capturedFrom.url !== document.capturedFrom?.url
            ? { document: { ...document, capturedFrom } }
            : {}),
        });

        revisionRef.current = saved.revision;
        syncedTextRef.current = text;
        setConflict(false);
      } catch (error) {
        if (isConflictError(error)) {
          setConflict(true);
        } else {
          toast.error(getErrorMessage(error, "This note didn't save. Your text is still here."));
        }

        throw error;
      }
    },
    [editSession, save],
  );

  const reloadLatest = async () => {
    const { data } = await refetch();

    if (data) {
      revisionRef.current = data.revision;
      syncedTextRef.current = noteEditorText(data);
    }

    return data;
  };

  return (
    <div
      data-polychat-theme={theme === "sepia" ? "paper" : undefined}
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden text-foreground",
        theme === "sepia" ? "bg-canvas" : "bg-surface",
      )}
    >
      {conflict ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 border-b border-attention/40 bg-attention/10 px-4 py-2 text-sm text-foreground"
        >
          <span className="flex-1">
            This note changed somewhere else, so your latest edits are not saved yet.
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              void reloadLatest().then(() => {
                suppressSavesRef.current = true;
                setConflict(false);
                setEditorKey((key) => key + 1);
              })
            }
          >
            Use the saved version
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              void reloadLatest().then(() => saveText(latestTextRef.current).catch(() => undefined))
            }
          >
            Keep my edits
          </Button>
        </div>
      ) : null}
      <NoteEditor
        key={editorKey}
        noteId={source.id}
        initialText={noteEditorText(source)}
        canSave={!conflict}
        onSave={saveText}
        onTextChange={(text) => {
          latestTextRef.current = text;
          onTextChange?.(text);
        }}
        renderMetadata={(text) => <NoteMetadataPanel source={source} text={text} isEditable />}
      />
    </div>
  );
}
