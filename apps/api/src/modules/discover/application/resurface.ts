import {
  FLASHCARDS_OUTPUT_KIND,
  studyProgressSchema,
  type DiscoverFollow,
} from "@ngriffin_uk/polychat-schemas";
import { shiftCalendarDate } from "@ngriffin_uk/polychat-utility-core";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import type { DiscoverFeedbackEntry } from "~/modules/discover/domain/feedback";
import {
  aYearAgo,
  collectResurfacing,
  missedFlashcards,
  savedToRevisit,
  type ResurfaceCandidate,
  type StudySetProgress,
} from "~/modules/discover/domain/resurface";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";

const YEAR_AGO_SCAN_LIMIT = 10;

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

async function loadYearAgoConversations(context: ServiceContext, userId: number, today: string) {
  const page = await context.repositories
    .get(ConversationRepository)
    .listUserConversations(userId, {
      createdAfter: shiftCalendarDate(today, -368),
      createdBefore: shiftCalendarDate(today, -361),
      sortBy: "created",
      archiveFilter: "all",
      teammateThreads: "exclude",
      limit: YEAR_AGO_SCAN_LIMIT,
    });

  return page.data.map((row) => ({
    id: typeof row.id === "string" ? row.id : "",
    title: typeof row.title === "string" ? row.title : "",
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  }));
}

export async function loadResurfaceCandidates(
  context: ServiceContext,
  input: {
    userId: number;
    follows: readonly DiscoverFollow[];
    feedback: readonly DiscoverFeedbackEntry[];
    today: string;
    now: number;
  },
): Promise<ResurfaceCandidate[]> {
  const [studySets, yearAgo] = await Promise.all([
    loadStudySets(context, input.userId, input.follows),
    loadYearAgoConversations(context, input.userId, input.today),
  ]);

  return collectResurfacing(
    missedFlashcards(studySets),
    savedToRevisit(input.feedback, input.now),
    aYearAgo(yearAgo, input.today),
  );
}
