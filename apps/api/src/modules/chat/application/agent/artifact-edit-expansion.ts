import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  createArtifactVersionTracker,
  expandArtifactEdits,
  findLatestArtifactContent,
} from "@ngriffin_uk/polychat-library-chat/artifact-edits";

import type { TurnOutput } from "~/modules/chat/application/agent/assistant-turn";
import type { Message } from "~/types";

const logger = getLogger({ prefix: "services/chat/agent/artifact-edit-expansion" });
const EDIT_MARKER = 'mode="edit"';

function mentionsArtifactEdit(text: string): boolean {
  return text.toLowerCase().includes(EDIT_MARKER);
}

function hasArtifactEdits(turn: TurnOutput): boolean {
  return (
    mentionsArtifactEdit(turn.content) ||
    (turn.parts ?? []).some((part) => part.type === "text" && mentionsArtifactEdit(part.text))
  );
}

export async function expandTurnArtifactEdits(params: {
  turn: TurnOutput;
  loadHistory: () => Promise<Message[]>;
}): Promise<{ turn: TurnOutput; changed: boolean }> {
  if (!hasArtifactEdits(params.turn)) {
    return { turn: params.turn, changed: false };
  }

  const history = await params.loadHistory();
  const resolvePrevious = (identifier: string) => findLatestArtifactContent(history, identifier);
  const content = expandArtifactEdits(
    params.turn.content,
    createArtifactVersionTracker(resolvePrevious),
  );
  const partsTracker = createArtifactVersionTracker(resolvePrevious);
  const parts = params.turn.parts?.map((part) =>
    part.type === "text"
      ? { ...part, text: expandArtifactEdits(part.text, partsTracker).content }
      : part,
  );

  if (content.failures.length > 0) {
    logger.warn("Some artifact edits could not be applied", { failures: content.failures });
  }

  return {
    turn: { ...params.turn, content: content.content, ...(parts ? { parts } : {}) },
    changed: content.changed,
  };
}
