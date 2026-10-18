import {
  POLY_HANDOFF_CAPABILITY_ID,
  POLY_TEAMMATE_ID,
  type PolyHandoffData,
  type PolyHandoffSourceKind,
} from "@ngriffin_uk/polychat-schemas";
import { truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";

export interface SkillProposalInput {
  userId: number;
  kind: Extract<PolyHandoffSourceKind, "skill_draft" | "skill_review">;
  skillName: string;
  groupKey: string;
  title: string;
  summary: string;
  reason: string;
  conversationId: string | null;
}

export async function recordSkillProposal(
  context: ServiceContext,
  input: SkillProposalInput,
): Promise<boolean> {
  const polyContext = await context.repositories.get(TeammateContextRepository).getByIdentity({
    teammateId: POLY_TEAMMATE_ID,
    actorUserId: input.userId,
    scope: { type: "personal", id: String(input.userId) },
  });

  if (!polyContext || polyContext.status !== "active") {
    return false;
  }

  const data: PolyHandoffData = {
    sourceKind: input.kind,
    sourceId: input.skillName,
    resultConversationId: input.conversationId,
    urgency: "low",
    decision: "noted",
    reason: input.reason,
    summary: input.summary,
    receipt: null,
  };

  await context.repositories.get(ActivityRepository).recordActivityOnce({
    id: `poly_${input.kind}_${input.groupKey}`,
    createdByUserId: input.userId,
    conversationId: polyContext.homeConversationId,
    capabilityId: POLY_HANDOFF_CAPABILITY_ID,
    groupId: `${input.kind}:${input.groupKey}`,
    kind: input.kind,
    status: "succeeded",
    summary: truncateSingleLine(input.title, 200),
    data,
    createdAt: new Date().toISOString(),
  });

  return true;
}
