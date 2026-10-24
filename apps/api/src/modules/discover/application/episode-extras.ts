import { notebookStudioRequestSchema } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { episodeNarration, episodeStudyGroupId } from "~/modules/discover/domain/episodes";
import {
  STUDIO_OUTPUT_SHAPES,
  writeStudioDraft,
} from "~/modules/notebooks/application/studio/drafts";
import { createOutput } from "~/modules/outputs/application";
import { createOutputProvenance } from "~/modules/outputs/application/provenance";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";

import { requireDiscoverEpisode } from "./episodes";

const STUDY_KINDS = ["quiz", "flashcards"] as const;

export async function makeEpisodeStudySet(
  context: ServiceContext,
  episodeId: string,
): Promise<number> {
  const user = context.requireUser();
  const { content } = await requireDiscoverEpisode(context, episodeId);

  if (!content.notebookId) {
    return 0;
  }

  const outputs = context.repositories.get(OutputRepository);
  const material = episodeNarration(content);
  let made = 0;

  for (const kind of STUDY_KINDS) {
    const groupId = episodeStudyGroupId(episodeId, kind);

    if (await outputs.getOutputByGroupId(groupId)) {
      continue;
    }

    const request = notebookStudioRequestSchema.parse({
      kind,
      focus: `Part ${content.part} of the season on ${content.topic}: ${content.title}`,
    });

    if (request.kind !== "quiz" && request.kind !== "flashcards") {
      continue;
    }

    const draft = await writeStudioDraft(context, request, material);
    const shape = STUDIO_OUTPUT_SHAPES[request.kind];

    await createOutput(
      context,
      user.id,
      {
        projectId: null,
        capabilityId: shape.capabilityId,
        kind: shape.outputKind,
        title: draft.title,
        status: "ready",
        groupId,
        content: draft.content,
      },
      {
        collectionId: content.notebookId,
        provenance: createOutputProvenance({ origin: "generated", completeness: "complete" }),
      },
    );
    made += 1;
  }

  return made;
}
