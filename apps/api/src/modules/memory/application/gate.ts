import { noul } from "@ngriffin_uk/polychat-ai-functions";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import { ai } from "~/infrastructure/ai";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "services/memory/gate" });

export const MEMORY_GATE_SKIP_THRESHOLD = 0.25;

const MEMORY_GATE_QUESTIONS = {
  worth_remembering: noul(
    "Does `message` state something durable about the person that an assistant should remember in future conversations, such as a fact about them, a preference, a plan, an appointment, or a goal?",
    {
      true: "The person shares a lasting fact, preference, relationship, plan, appointment, goal or decision about themselves",
      false:
        "A question, a task for the assistant, small talk, or information that has no lasting value about the person",
    },
  ),
} as const;

export interface MemoryGateResult {
  proceed: boolean;
  probability: number | null;
}

export async function gateMemoryClassification(params: {
  env: IEnv;
  user?: IUser;
  message: string;
  completionId?: string;
  threshold?: number;
}): Promise<MemoryGateResult> {
  const threshold = params.threshold ?? MEMORY_GATE_SKIP_THRESHOLD;

  try {
    const decided = await ai.tryDecide({
      env: params.env,
      user: params.user,
      completion_id: params.completionId,
      state: { message: params.message },
      questions: MEMORY_GATE_QUESTIONS,
    });

    if (!decided) {
      return { proceed: true, probability: null };
    }

    const probability = decided.answers.worth_remembering.noul;

    return { proceed: probability >= threshold, probability };
  } catch (error) {
    logger.warn("Memory gate failed; classifying without it", { error });

    return { proceed: true, probability: null };
  }
}
