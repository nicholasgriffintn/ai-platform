import { matchesToolArgs } from "@ngriffin_uk/polychat-library-model-registry/tool-use";
import type { ToolUseEvalCall, ToolUseEvalSpec } from "@ngriffin_uk/polychat-schemas";
import { parseAIResponseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { ai } from "~/infrastructure/ai";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import type { IEnv, IUser } from "~/types";

export interface MockedToolResult {
  result: unknown;
  mocked: ToolUseEvalCall["mocked"];
}

const MISSING_RESULT = {
  status: "unavailable",
  message: "This tool returned nothing in this environment.",
};

const ENVIRONMENT_SYSTEM_PROMPT = [
  "You play the environment behind a tool in a test. Reply with only the JSON result the tool would return.",
  "Stay consistent with the facts and world state you are given. Never reveal the facts unless the call would really return them.",
  "When the call cannot succeed against those facts, return the error the tool would return.",
].join(" ");

function buildEnvironmentPrompt(params: {
  spec: ToolUseEvalSpec;
  tool: string;
  description: string | undefined;
  args: Record<string, unknown>;
}): string {
  return JSON.stringify({
    facts: params.spec.setup.facts,
    world: params.spec.setup.world ?? {},
    tool: { name: params.tool, description: params.description ?? "" },
    arguments: params.args,
  });
}

async function playEnvironment(params: {
  env: IEnv;
  user: IUser;
  spec: ToolUseEvalSpec;
  tool: string;
  description: string | undefined;
  args: Record<string, unknown>;
}): Promise<unknown> {
  const target = await getAuxiliaryModel(params.env, params.user);
  const completion = await ai.complete({
    env: params.env,
    user: params.user,
    model: target.model,
    provider: target.provider,
    reasoning_effort: target.effort,
    system: ENVIRONMENT_SYSTEM_PROMPT,
    prompt: buildEnvironmentPrompt(params),
  });
  const parsed = parseAIResponseJson<unknown>(completion.text);

  return parsed.data ?? completion.text;
}

export async function resolveMockedToolResult(params: {
  env: IEnv;
  user: IUser;
  spec: ToolUseEvalSpec;
  tool: string;
  description: string | undefined;
  args: Record<string, unknown>;
}): Promise<MockedToolResult> {
  const canned = (params.spec.setup.mocks[params.tool] ?? []).find(
    (mock) => !mock.args || matchesToolArgs(mock.args, params.args),
  );

  if (canned) {
    return { result: canned.result, mocked: "canned" };
  }

  if (params.spec.setup.facts) {
    return { result: await playEnvironment(params), mocked: "environment" };
  }

  return { result: MISSING_RESULT, mocked: "missing" };
}
