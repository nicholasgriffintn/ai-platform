import { ApiError } from "@ngriffin_uk/polychat-library-client";
import type { MemoryDocument } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useRef, useState } from "react";

export type MemoryDocumentEditorSnapshot = Pick<MemoryDocument, "content" | "revision">;
export type MemoryDocumentEditorStatus = "idle" | "saving" | "conflict" | "error";

export interface MemoryDocumentEditorState {
  base: MemoryDocumentEditorSnapshot | null;
  draft: string;
  submitted: MemoryDocumentEditorSnapshot | null;
  incoming: MemoryDocumentEditorSnapshot | null;
  status: MemoryDocumentEditorStatus;
  error: Error | null;
}

export interface SaveMemoryDocumentRevisionInput {
  content: string;
  expectedRevision: number;
}

export interface UseMemoryDocumentEditorOptions {
  document: MemoryDocument | undefined;
  saveDocument: (input: SaveMemoryDocumentRevisionInput) => Promise<MemoryDocument>;
  loadDocument: () => Promise<MemoryDocument>;
}

function snapshot(document: MemoryDocument): MemoryDocumentEditorSnapshot {
  return { content: document.content, revision: document.revision };
}

function initialState(document: MemoryDocument | undefined): MemoryDocumentEditorState {
  const base = document ? snapshot(document) : null;

  return {
    base,
    draft: base?.content ?? "",
    submitted: null,
    incoming: null,
    status: "idle",
    error: null,
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Unable to save this memory document");
}

export function useMemoryDocumentEditor({
  document,
  saveDocument,
  loadDocument,
}: UseMemoryDocumentEditorOptions) {
  const [state, setState] = useState<MemoryDocumentEditorState>(() => initialState(document));
  const stateRef = useRef(state);
  const documentIdRef = useRef(document?.id);
  const requestGenerationRef = useRef(0);
  const inFlightRef = useRef(false);
  const saveDocumentRef = useRef(saveDocument);
  const loadDocumentRef = useRef(loadDocument);

  const updateState = useCallback(
    (update: (current: MemoryDocumentEditorState) => MemoryDocumentEditorState) => {
      setState((current) => {
        const next = update(current);

        stateRef.current = next;

        return next;
      });
    },
    [],
  );

  useEffect(() => {
    saveDocumentRef.current = saveDocument;
    loadDocumentRef.current = loadDocument;
  }, [loadDocument, saveDocument]);

  useEffect(() => {
    if (documentIdRef.current !== document?.id) {
      documentIdRef.current = document?.id;
      requestGenerationRef.current += 1;
      inFlightRef.current = false;
      const next = initialState(document);

      stateRef.current = next;
      setState(next);

      return;
    }

    if (!document) {
      return;
    }

    updateState((current) => {
      const nextSnapshot = snapshot(document);
      const newestRevision = Math.max(
        current.base?.revision ?? 0,
        current.incoming?.revision ?? 0,
        current.submitted?.revision ?? 0,
      );

      if (nextSnapshot.revision <= newestRevision) {
        return current;
      }

      const isClean = current.draft === current.base?.content && current.submitted === null;

      if (isClean) {
        return {
          ...current,
          base: nextSnapshot,
          draft: nextSnapshot.content,
          incoming: null,
          status: "idle",
          error: null,
        };
      }

      return {
        ...current,
        incoming: nextSnapshot,
        status: current.status === "saving" ? "saving" : "conflict",
      };
    });
  }, [document, updateState]);

  const edit = useCallback(
    (draft: string) => {
      updateState((current) => ({ ...current, draft, error: null }));
    },
    [updateState],
  );

  const discard = useCallback(() => {
    updateState((current) => ({
      ...current,
      draft: current.base?.content ?? "",
      status: current.incoming ? "conflict" : "idle",
      error: null,
    }));
  }, [updateState]);

  const useServer = useCallback(() => {
    updateState((current) => {
      if (!current.incoming) {
        return current;
      }

      return {
        ...current,
        base: current.incoming,
        draft: current.incoming.content,
        submitted: null,
        incoming: null,
        status: "idle",
        error: null,
      };
    });
  }, [updateState]);

  const keepMyEdits = useCallback(() => {
    updateState((current) => {
      if (!current.incoming) {
        return current;
      }

      return {
        ...current,
        base: current.incoming,
        submitted: null,
        incoming: null,
        status: "idle",
        error: null,
      };
    });
  }, [updateState]);

  const save = useCallback(async (): Promise<boolean> => {
    const current = stateRef.current;

    if (
      inFlightRef.current ||
      !documentIdRef.current ||
      !current.base ||
      current.draft === current.base.content
    ) {
      return false;
    }

    const documentId = documentIdRef.current;
    const generation = requestGenerationRef.current;
    const submitted = { content: current.draft, revision: current.base.revision };

    inFlightRef.current = true;
    updateState((latest) => ({
      ...latest,
      submitted,
      status: "saving",
      error: null,
    }));

    try {
      const saved = await saveDocumentRef.current({
        content: submitted.content,
        expectedRevision: submitted.revision,
      });

      if (
        generation !== requestGenerationRef.current ||
        documentId !== documentIdRef.current ||
        saved.id !== documentId
      ) {
        return false;
      }

      const acknowledged = snapshot(saved);

      updateState((latest) => {
        const incoming =
          latest.incoming && latest.incoming.revision > acknowledged.revision
            ? latest.incoming
            : null;

        return {
          ...latest,
          base: acknowledged,
          draft: latest.draft === submitted.content ? acknowledged.content : latest.draft,
          submitted: null,
          incoming,
          status: incoming ? "conflict" : "idle",
          error: null,
        };
      });

      return true;
    } catch (saveError) {
      if (generation !== requestGenerationRef.current || documentId !== documentIdRef.current) {
        return false;
      }

      if (saveError instanceof ApiError && saveError.status === 409) {
        try {
          const currentDocument = await loadDocumentRef.current();

          if (
            generation !== requestGenerationRef.current ||
            documentId !== documentIdRef.current ||
            currentDocument.id !== documentId
          ) {
            return false;
          }

          updateState((latest) => {
            const incoming =
              currentDocument.revision > (latest.base?.revision ?? 0)
                ? snapshot(currentDocument)
                : latest.incoming;

            return {
              ...latest,
              submitted: null,
              incoming,
              status: incoming ? "conflict" : "error",
              error: incoming
                ? null
                : new Error("The latest saved revision is not available yet. Try saving again."),
            };
          });
        } catch (loadError) {
          if (generation !== requestGenerationRef.current || documentId !== documentIdRef.current) {
            return false;
          }

          updateState((latest) => ({
            ...latest,
            submitted: null,
            status: "error",
            error: toError(loadError),
          }));
        }
      } else {
        updateState((latest) => ({
          ...latest,
          submitted: null,
          status: "error",
          error: toError(saveError),
        }));
      }

      return false;
    } finally {
      if (generation === requestGenerationRef.current && documentId === documentIdRef.current) {
        inFlightRef.current = false;
      }
    }
  }, [updateState]);

  return {
    ...state,
    isDirty: Boolean(state.base && state.draft !== state.base.content),
    edit,
    discard,
    save,
    useServer,
    keepMyEdits,
  };
}
