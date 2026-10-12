import { decisionsService } from "@ngriffin_uk/polychat-library-client";
import { encodeImageAsJpegDataUrl } from "@ngriffin_uk/polychat-library-realtime/media-encoding";
import { createConcurrencyLimiter } from "@ngriffin_uk/polychat-utility-core";
import { useCallback, useEffect, useRef, useState } from "react";

import { MAX_PILES, PILE_PRESETS, createPiles, type Pile, type PilePreset } from "./piles.js";
import { buildSortRequest, readSortResult, type SortResult } from "./sorting.js";

const MAX_DIMENSION = 768;
const MAX_PHOTOS = 80;
const PARALLEL_SORTS = 3;

export type PhotoItem =
  | { id: string; name: string; previewUrl: string; state: "queued" | "sorting" }
  | { id: string; name: string; previewUrl: string; state: "failed"; error: string }
  | {
      id: string;
      name: string;
      previewUrl: string;
      state: "sorted";
      result: SortResult;
      manualPileId?: string;
    };

export function placedPileId(item: PhotoItem): string | null {
  return item.state === "sorted" ? (item.manualPileId ?? item.result.pileId) : null;
}

export function usePhotoSorter() {
  const [piles, setPiles] = useState<Pile[]>(() => createPiles(PILE_PRESETS[0]));
  const [items, setItems] = useState<PhotoItem[]>([]);
  const filesRef = useRef(new Map<string, { file: File; previewUrl: string }>());
  const limiterRef = useRef(createConcurrencyLimiter(PARALLEL_SORTS));
  const generationRef = useRef(0);
  const nextIdRef = useRef(0);

  const patch = useCallback((id: string, next: (item: PhotoItem) => PhotoItem) => {
    setItems((current) => current.map((item) => (item.id === id ? next(item) : item)));
  }, []);

  const sort = useCallback(
    (id: string, sortPiles: readonly Pile[]) => {
      const file = filesRef.current.get(id)?.file;
      const generation = generationRef.current;

      if (!file) {
        return;
      }

      void limiterRef.current(async () => {
        if (generation !== generationRef.current) {
          return;
        }

        patch(id, (item) => ({
          id,
          name: item.name,
          previewUrl: item.previewUrl,
          state: "sorting",
        }));

        try {
          const image = await encodeImageAsJpegDataUrl(file, MAX_DIMENSION);
          const response = await decisionsService.decide(buildSortRequest(image, sortPiles));
          const result = readSortResult(response);

          if (generation === generationRef.current) {
            patch(id, (item) => ({ ...item, state: "sorted", result }));
          }
        } catch (caught) {
          patch(id, (item) => ({
            id,
            name: item.name,
            previewUrl: item.previewUrl,
            state: "failed",
            error: caught instanceof Error ? caught.message : "Could not sort this one",
          }));
        }
      });
    },
    [patch],
  );

  const addFiles = useCallback(
    (files: readonly File[]) => {
      const room = MAX_PHOTOS - filesRef.current.size;
      const accepted = files.filter((file) => file.type.startsWith("image/")).slice(0, room);
      const added: PhotoItem[] = accepted.map((file) => {
        const id = `photo-${nextIdRef.current++}`;
        const previewUrl = URL.createObjectURL(file);

        filesRef.current.set(id, { file, previewUrl });

        return { id, name: file.name, previewUrl, state: "queued" };
      });

      setItems((current) => [...current, ...added]);
      added.forEach((item) => sort(item.id, piles));
    },
    [piles, sort],
  );

  const resortAll = useCallback(() => {
    generationRef.current += 1;
    setItems((current) =>
      current.map((item) => ({
        id: item.id,
        name: item.name,
        previewUrl: item.previewUrl,
        state: "queued",
      })),
    );
    filesRef.current.forEach((_, id) => sort(id, piles));
  }, [piles, sort]);

  const clear = useCallback(() => {
    generationRef.current += 1;
    filesRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
    filesRef.current.clear();
    setItems([]);
  }, []);

  const moveTo = useCallback(
    (id: string, pileId: string) => {
      patch(id, (item) => (item.state === "sorted" ? { ...item, manualPileId: pileId } : item));
    },
    [patch],
  );

  const applyPreset = useCallback((preset: PilePreset) => setPiles(createPiles(preset)), []);

  const updatePile = useCallback((id: string, label: string) => {
    setPiles((current) => current.map((pile) => (pile.id === id ? { ...pile, label } : pile)));
  }, []);

  const addPile = useCallback(() => {
    setPiles((current) =>
      current.length >= MAX_PILES
        ? current
        : [...current, { id: `p${Date.now()}`, label: "New pile", description: "" }],
    );
  }, []);

  const removePile = useCallback((id: string) => {
    setPiles((current) => current.filter((pile) => pile.id !== id));
  }, []);

  useEffect(() => {
    const files = filesRef.current;

    return () => {
      generationRef.current += 1;
      files.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      files.clear();
    };
  }, []);

  return {
    piles,
    items,
    addFiles,
    resortAll,
    clear,
    moveTo,
    applyPreset,
    updatePile,
    addPile,
    removePile,
  };
}
