import type { DatasetProfiler } from "@ngriffin_uk/polychat-library-model-registry";
import {
  canonicalText,
  estimateTokens,
  rowFlags,
} from "@ngriffin_uk/polychat-library-model-registry";
import type { DatasetSplit } from "@ngriffin_uk/polychat-schemas";
import { isRecord, readTextLines } from "@ngriffin_uk/polychat-utility-core";

import type { ArtefactStore } from "~/modules/model-registry/infrastructure/ArtefactStore";
import { artefactKeys } from "~/modules/model-registry/infrastructure/ArtefactStore";

import type { ModelDatasetProfileRecord } from "../infrastructure/ModelDatasetRepository";
import { MAX_FLAGGED_INDEXES, MAX_TRAINING_TOKENS } from "./limits";

export async function copyDatasetSplit(
  store: ArtefactStore,
  workspaceId: string,
  source: ModelDatasetProfileRecord,
  targetVersionId: string,
  split: DatasetSplit,
  excluded: ReadonlySet<number>,
  profiler: DatasetProfiler,
) {
  const object = await store.get(artefactKeys.datasetSplit(workspaceId, source.version_id, split));
  const expectedRows = source.stats.splits?.find((item) => item.name === split)?.rows ?? 0;

  if (!object && expectedRows > 0) {
    throw new Error(`The ${split} split is missing from storage`);
  }

  const writer = store.writer(artefactKeys.datasetSplit(workspaceId, targetVersionId, split));
  const previousFlags = new Set(source.stats.flaggedIndexes?.[split] ?? []);
  const flaggedIndexes: number[] = [];
  let index = 0;
  let kept = 0;

  if (object) {
    for await (const line of readTextLines(object.body)) {
      if (!line.trim()) {
        continue;
      }

      if (!excluded.has(index)) {
        const row: unknown = JSON.parse(line);

        if (!isRecord(row)) {
          throw new Error(`The ${split} split contains an invalid row`);
        }

        const text = canonicalText(row);
        const tokens = estimateTokens(text);
        const flagged =
          previousFlags.has(index) || rowFlags(text, tokens, MAX_TRAINING_TOKENS).length > 0;

        if (flagged && flaggedIndexes.length < MAX_FLAGGED_INDEXES) {
          flaggedIndexes.push(kept);
        }

        profiler.add({ split, text, redactedText: text, tokens, flagged });
        await writer.writeLine(row);
        kept += 1;
      }

      index += 1;
    }
  }

  return { bytes: await writer.close(), kept, flaggedIndexes };
}
