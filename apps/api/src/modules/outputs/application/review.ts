import {
  listPageOf,
  type CouncilReview,
  type CouncilReviewListResponse,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { councilReviewSubject } from "~/modules/outputs/domain/council-review";
import { OutputReviewRepository } from "~/modules/outputs/infrastructure/OutputReviewRepository";
import { runCouncilReview } from "~/modules/responses/application/engine/council-review";
import type { PanelCompletionScope } from "~/modules/responses/application/engine/panel";

import { requireOutputAccess } from "./access";
import { formatOutput } from "./index";

const PRIOR_BRIEFS = 3;
const LIST_LIMIT = 20;

export async function reviewOutput(
  context: ServiceContext,
  outputId: string,
  scope: Omit<PanelCompletionScope, "env" | "user">,
): Promise<CouncilReview> {
  const user = context.requireUser();
  const output = formatOutput(await requireOutputAccess(context, user.id, outputId));

  if (output.status !== "ready") {
    throw new AssistantError(
      "Only a finished output can be reviewed",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const priorBriefs = await context.repositories
    .get(OutputReviewRepository)
    .listRecentBriefsForKind({
      userId: user.id,
      projectId: output.projectId,
      outputKind: output.kind,
      excludeOutputId: output.id,
      limit: PRIOR_BRIEFS,
    });
  const result = await runCouncilReview(
    { ...scope, env: context.env, user },
    {
      title: output.title,
      kind: output.kind,
      text: councilReviewSubject(output.content),
      priorBriefs,
    },
  );
  const id = generateId();

  await context.repositories.get(OutputReviewRepository).create({
    id,
    outputId: output.id,
    outputRevision: output.revision,
    outputKind: output.kind,
    reviewedByUserId: user.id,
    projectId: output.projectId,
    verdict: result.verdict,
    brief: result.brief,
    dissent: result.dissent,
    seats: result.seats,
  });

  const stored = await context.repositories.get(OutputReviewRepository).getById(id);

  if (!stored) {
    throw new AssistantError("The review was not saved", ErrorType.DATABASE_ERROR);
  }

  return stored;
}

export async function listOutputReviews(
  context: ServiceContext,
  outputId: string,
): Promise<CouncilReviewListResponse> {
  const user = context.requireUser();

  await requireOutputAccess(context, user.id, outputId);

  return listPageOf(
    await context.repositories.get(OutputReviewRepository).listForOutput(outputId, LIST_LIMIT),
    (review) => review.id,
  );
}
