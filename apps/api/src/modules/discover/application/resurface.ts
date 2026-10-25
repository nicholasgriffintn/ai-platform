import {
  FLASHCARDS_OUTPUT_KIND,
  studyProgressSchema,
  type DiscoverFollow,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { DiscoverFeedbackEntry } from "~/modules/discover/domain/feedback";
import {
  collectResurfacing,
  missedFlashcards,
  savedToRevisit,
  type ResurfaceCandidate,
  type StudySetProgress,
} from "~/modules/discover/domain/resurface";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";

async function loadStudySets(
  context: ServiceContext,
  userId: number,
  follows: readonly DiscoverFollow[],
): Promise<StudySetProgress[]> {
  const outputs = context.repositories.get(OutputRepository);
  const sets = await Promise.all(
    follows.map(async (follow) => {
      const flashcards = (await outputs.listCollectionOutputs(follow.notebookId)).filter(
        (output) => output.kind === FLASHCARDS_OUTPUT_KIND,
      );

      return Promise.all(
        flashcards.map(async (output) => {
          const progress = studyProgressSchema.safeParse(
            safeParseJson(await outputs.readViewerState(output.id, userId)) ?? {},
          );

          return {
            outputId: output.id,
            title: output.title,
            missed: progress.success ? progress.data.missed.length : 0,
          };
        }),
      );
    }),
  );

  return sets.flat();
}

export async function loadResurfaceCandidates(
  context: ServiceContext,
  input: {
    userId: number;
    follows: readonly DiscoverFollow[];
    feedback: readonly DiscoverFeedbackEntry[];
    now: number;
  },
): Promise<ResurfaceCandidate[]> {
  const studySets = await loadStudySets(context, input.userId, input.follows);

  return collectResurfacing(missedFlashcards(studySets), savedToRevisit(input.feedback, input.now));
}
