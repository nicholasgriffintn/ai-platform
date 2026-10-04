import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { TeammateComputerInput } from "@ngriffin_uk/polychat-schemas";
import { truncateForModel } from "@ngriffin_uk/polychat-utility-core";
import {
  redactSensitiveTokens,
  redactSensitiveUrl,
} from "@ngriffin_uk/polychat-utility-server/redaction";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { operateTeammateComputerAsAgent } from "~/modules/teammates/application/computers";
import type { IEnv, IUser } from "~/types";

import { COMPUTER_SEEK_POLICY, type SeekStepOutcome } from "./seek-policy";

const logger = getLogger({ prefix: "services/computer-use/seek" });

const MAX_OBSERVATION_CHARS = 16_000;
const SCROLL_AMOUNT = 5;
const WAIT_DURATION_MS = 1_500;

export type SeekConclusion = "reached" | "blocked" | "exhausted" | "unavailable";

export interface SeekStepRecord {
  step: number;
  outcome: SeekStepOutcome;
  confidence: number;
}

export interface SeekResult {
  conclusion: SeekConclusion;
  steps: SeekStepRecord[];
  observation: Record<string, unknown>;
}

function stepInput(outcome: SeekStepOutcome): TeammateComputerInput | null {
  if (outcome === "scroll_down") {
    return { type: "scroll", direction: "down", amount: SCROLL_AMOUNT };
  }

  if (outcome === "scroll_up") {
    return { type: "scroll", direction: "up", amount: SCROLL_AMOUNT };
  }

  if (outcome === "wait") {
    return { type: "wait", durationMs: WAIT_DURATION_MS };
  }

  return null;
}

function observationState(goal: string, observation: Record<string, unknown>) {
  return {
    goal: truncateForModel(redactSensitiveTokens(goal), 2_000),
    observation: {
      title:
        typeof observation.title === "string"
          ? truncateForModel(redactSensitiveTokens(observation.title), 1_000)
          : null,
      text:
        typeof observation.text === "string"
          ? truncateForModel(
              redactSensitiveTokens(observation.text),
              MAX_OBSERVATION_CHARS - "\n... (truncated)".length,
            )
          : null,
      url:
        typeof observation.url === "string"
          ? truncateForModel(redactSensitiveUrl(observation.url), 2_048)
          : null,
    },
  };
}

export interface SeekRequest {
  env: IEnv;
  user?: IUser;
  context: ServiceContext;
  contextId: string;
  runId: string;
  runAttempt: number;
  completionId: string;
  conversationId?: string;
  goal: string;
  maxSteps: number;
}

export async function seekOnComputer(request: SeekRequest): Promise<SeekResult> {
  const steps: SeekStepRecord[] = [];
  let observation: Record<string, unknown> = {};

  for (let step = 1; step <= request.maxSteps; step += 1) {
    const result = await operateTeammateComputerAsAgent({
      context: request.context,
      contextId: request.contextId,
      runId: request.runId,
      runAttempt: request.runAttempt,
      input: { type: "read" },
    });

    observation = result.observation ?? {};

    const decision = await ai.evaluateDecisionPolicy({
      env: request.env,
      user: request.user,
      completion_id: request.completionId,
      conversationId: request.conversationId,
      state: observationState(request.goal, observation),
      policy: COMPUTER_SEEK_POLICY,
      fallback: "blocked",
    });

    if (!decision.receipt.applied) {
      logger.info("Computer seek stopped because no decision model was available", {
        completion_id: request.completionId,
        status: decision.receipt.status,
      });

      return { conclusion: "unavailable", steps, observation };
    }

    const outcome = decision.outcome;

    steps.push({
      step,
      outcome,
      confidence: decision.receipt.recommendation?.confidence ?? 0,
    });

    if (outcome === "done") {
      return { conclusion: "reached", steps, observation };
    }

    const input = stepInput(outcome);

    if (!input) {
      return { conclusion: "blocked", steps, observation };
    }

    const applied = await operateTeammateComputerAsAgent({
      context: request.context,
      contextId: request.contextId,
      runId: request.runId,
      runAttempt: request.runAttempt,
      input,
    });

    observation = applied.observation ?? {};
  }

  return { conclusion: "exhausted", steps, observation };
}
