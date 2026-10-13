import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  decisionNoulConfidence,
  type DecisionChoiceAnswer,
  type DecisionNoulAnswer,
  type TeammateComputerInput,
} from "@ngriffin_uk/polychat-schemas";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { operateTeammateComputerAsAgent } from "~/modules/teammates/application/computers";
import type { IEnv, IUser } from "~/types";

import {
  actState,
  buildActQuestions,
  clickableElements,
  elementOptionId,
  readPageElements,
  type ActReadingAction,
  type PageElement,
} from "./act-questions";

const logger = getLogger({ prefix: "services/computer-use/act" });

const GOAL_MET_THRESHOLD = 0.8;
const GOAL_CONFIDENCE_THRESHOLD = 0.6;
const ACTION_CONFIDENCE_THRESHOLD = 0.4;
const SCROLL_AMOUNT = 5;
const WAIT_DURATION_MS = 1_500;

export type ActConclusion =
  | "reached"
  | "blocked"
  | "needs_input"
  | "exhausted"
  | "unavailable"
  | "undecided";

export interface ActStepRecord {
  step: number;
  action: string;
  target?: string;
  confidence: number;
}

export interface ActResult {
  conclusion: ActConclusion;
  steps: ActStepRecord[];
  observation: Record<string, unknown>;
}

function readingInput(action: ActReadingAction): TeammateComputerInput | null {
  if (action === "scroll_down") {
    return { type: "scroll", direction: "down", amount: SCROLL_AMOUNT };
  }

  if (action === "scroll_up") {
    return { type: "scroll", direction: "up", amount: SCROLL_AMOUNT };
  }

  if (action === "wait") {
    return { type: "wait", durationMs: WAIT_DURATION_MS };
  }

  return null;
}

function chosenElement(
  choiceId: string,
  clickable: readonly PageElement[],
): PageElement | undefined {
  const index = clickable.findIndex((_element, position) => elementOptionId(position) === choiceId);

  return index >= 0 ? clickable[index] : undefined;
}

function goalReached(answer: DecisionNoulAnswer): boolean {
  return (
    answer.noul >= GOAL_MET_THRESHOLD && decisionNoulConfidence(answer) >= GOAL_CONFIDENCE_THRESHOLD
  );
}

export interface ActRequest {
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

export async function actOnComputer(request: ActRequest): Promise<ActResult> {
  const steps: ActStepRecord[] = [];
  let observation: Record<string, unknown> = {};

  for (let step = 1; step <= request.maxSteps; step += 1) {
    const read = await operateTeammateComputerAsAgent({
      context: request.context,
      contextId: request.contextId,
      runId: request.runId,
      runAttempt: request.runAttempt,
      input: { type: "elements" },
    });

    observation = read.observation ?? {};

    const clickable = clickableElements(readPageElements(observation));
    const decision = await ai.tryDecide({
      env: request.env,
      user: request.user,
      completion_id: request.completionId,
      conversationId: request.conversationId,
      state: actState(request.goal, observation),
      questions: buildActQuestions({ goal: request.goal, observation, clickable }),
    });

    if (!decision) {
      logger.info("Computer act stopped because no decision model was available", {
        completion_id: request.completionId,
      });

      return { conclusion: "unavailable", steps, observation };
    }

    const reached = decision.answers.goal_reached as DecisionNoulAnswer;

    if (goalReached(reached)) {
      steps.push({ step, action: "done", confidence: decisionNoulConfidence(reached) });

      return { conclusion: "reached", steps, observation };
    }

    const next = decision.answers.next_action as DecisionChoiceAnswer;

    if (next.confidence < ACTION_CONFIDENCE_THRESHOLD) {
      steps.push({ step, action: "undecided", confidence: next.confidence });

      return { conclusion: "undecided", steps, observation };
    }

    const element = chosenElement(next.choice, clickable);

    if (element) {
      steps.push({
        step,
        action: "click",
        target: `${element.role}: ${element.name}`,
        confidence: next.confidence,
      });

      const clicked = await operateTeammateComputerAsAgent({
        context: request.context,
        contextId: request.contextId,
        runId: request.runId,
        runAttempt: request.runAttempt,
        input: { type: "click", x: element.x, y: element.y, button: "left" },
      });

      observation = clicked.observation ?? {};
      continue;
    }

    const action = next.choice as ActReadingAction;

    steps.push({ step, action, confidence: next.confidence });

    if (action === "needs_input" || action === "blocked") {
      return {
        conclusion: action === "needs_input" ? "needs_input" : "blocked",
        steps,
        observation,
      };
    }

    const input = readingInput(action);

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
