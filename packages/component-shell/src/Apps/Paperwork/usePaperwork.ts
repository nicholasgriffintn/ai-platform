import { extractionsService } from "@ngriffin_uk/polychat-library-client";
import { encodeImageAsJpegDataUrl } from "@ngriffin_uk/polychat-library-realtime/media-encoding";
import type { ExtractionResponse } from "@ngriffin_uk/polychat-schemas";
import { createConcurrencyLimiter, describeZonedInstant } from "@ngriffin_uk/polychat-utility-core";
import { useCallback, useEffect, useRef, useState } from "react";

import { PAPERWORK_FORMS, type PaperworkForm } from "./forms.js";
import { buildExtractionRequest, type PaperworkSource } from "./reading.js";

const MAX_DIMENSION = 1600;
const MAX_DOCUMENTS = 24;
const PARALLEL_READS = 3;

type DocumentInput =
  | { kind: "image"; file: File; previewUrl: string }
  | { kind: "text"; text: string };

interface DocumentBase {
  id: string;
  name: string;
  previewUrl?: string;
  text?: string;
}

export type PaperworkDocument =
  | (DocumentBase & { state: "queued" | "reading" })
  | (DocumentBase & { state: "failed"; error: string })
  | (DocumentBase & { state: "read"; response: ExtractionResponse });

async function toSource(input: DocumentInput): Promise<PaperworkSource> {
  return input.kind === "image"
    ? { kind: "image", dataUrl: await encodeImageAsJpegDataUrl(input.file, MAX_DIMENSION) }
    : { kind: "text", text: input.text };
}

function pending(document: PaperworkDocument, state: "queued" | "reading"): PaperworkDocument {
  return {
    id: document.id,
    name: document.name,
    previewUrl: document.previewUrl,
    text: document.text,
    state,
  };
}

export function usePaperwork() {
  const [form, setForm] = useState<PaperworkForm>(PAPERWORK_FORMS[0]);
  const [documents, setDocuments] = useState<PaperworkDocument[]>([]);
  const inputsRef = useRef(new Map<string, DocumentInput>());
  const limiterRef = useRef(createConcurrencyLimiter(PARALLEL_READS));
  const generationRef = useRef(0);
  const nextIdRef = useRef(0);

  const patch = useCallback(
    (id: string, next: (document: PaperworkDocument) => PaperworkDocument) => {
      setDocuments((current) =>
        current.map((document) => (document.id === id ? next(document) : document)),
      );
    },
    [],
  );

  const read = useCallback(
    (id: string, readForm: PaperworkForm) => {
      const input = inputsRef.current.get(id);
      const generation = generationRef.current;

      if (!input) {
        return;
      }

      void limiterRef.current(async () => {
        if (generation !== generationRef.current) {
          return;
        }

        patch(id, (document) => pending(document, "reading"));

        try {
          const request = buildExtractionRequest(
            readForm,
            await toSource(input),
            describeZonedInstant(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone).date,
          );
          const response = await extractionsService.extract(request);

          if (generation === generationRef.current) {
            patch(id, (document) => ({ ...pending(document, "reading"), state: "read", response }));
          }
        } catch (caught) {
          if (generation === generationRef.current) {
            patch(id, (document) => ({
              ...pending(document, "reading"),
              state: "failed",
              error: caught instanceof Error ? caught.message : "Could not read this one",
            }));
          }
        }
      });
    },
    [patch],
  );

  const add = useCallback(
    (entries: readonly { name: string; input: DocumentInput }[]) => {
      const room = MAX_DOCUMENTS - inputsRef.current.size;
      const added: PaperworkDocument[] = entries
        .slice(0, Math.max(0, room))
        .map(({ name, input }) => {
          const id = `document-${nextIdRef.current++}`;

          inputsRef.current.set(id, input);

          return input.kind === "image"
            ? { id, name, previewUrl: input.previewUrl, state: "queued" }
            : { id, name, text: input.text, state: "queued" };
        });

      setDocuments((current) => [...current, ...added]);
      added.forEach((document) => read(document.id, form));
    },
    [form, read],
  );

  const addFiles = useCallback(
    (files: readonly File[]) => {
      add(
        files
          .filter((file) => file.type.startsWith("image/"))
          .map((file) => ({
            name: file.name,
            input: { kind: "image", file, previewUrl: URL.createObjectURL(file) },
          })),
      );
    },
    [add],
  );

  const addText = useCallback(
    (text: string) => {
      const trimmed = text.trim();

      if (trimmed) {
        add([
          {
            name: trimmed.split("\n")[0]?.slice(0, 60) ?? "Pasted text",
            input: { kind: "text", text: trimmed },
          },
        ]);
      }
    },
    [add],
  );

  const chooseForm = useCallback(
    (next: PaperworkForm) => {
      generationRef.current += 1;
      setForm(next);
      setDocuments((current) => current.map((document) => pending(document, "queued")));
      inputsRef.current.forEach((_, id) => read(id, next));
    },
    [read],
  );

  const releaseInputs = useCallback(() => {
    inputsRef.current.forEach((input) => {
      if (input.kind === "image") {
        URL.revokeObjectURL(input.previewUrl);
      }
    });
    inputsRef.current.clear();
  }, []);

  const clear = useCallback(() => {
    generationRef.current += 1;
    releaseInputs();
    setDocuments([]);
  }, [releaseInputs]);

  useEffect(
    () => () => {
      generationRef.current += 1;
      releaseInputs();
    },
    [releaseInputs],
  );

  return { form, documents, addFiles, addText, chooseForm, clear };
}
