import type {
  RealtimePipelineSessionCreate,
  RealtimePipelineSessionResponse,
} from "@ngriffin_uk/polychat-schemas";
import { realtimeSessionResponseSchema } from "@ngriffin_uk/polychat-schemas";

import { getRealtimeProvider } from "~/lib/providers/capabilities/realtime";
import type { IEnv, IUser } from "~/types";
import { generateId } from "~/utils/id";

import { getAccessibleRealtimeModel } from "./access";

type PipelineStageName = "Input" | "Reasoning" | "Output";

async function validatePipelineStage({
  env,
  model,
  name,
  provider,
  user,
}: {
  env: IEnv;
  model: string;
  name: PipelineStageName;
  provider: string;
  user: IUser;
}): Promise<{ message: string; status: 400 | 403 } | undefined> {
  const accessibleModel = await getAccessibleRealtimeModel({
    env,
    model,
    provider,
    user,
  });

  if (!accessibleModel) {
    return {
      message: `${name} model not found or user does not have access`,
      status: 403,
    };
  }

  return undefined;
}

export async function createRealtimePipelineSession({
  env,
  request,
  user,
}: {
  env: IEnv;
  request: RealtimePipelineSessionCreate;
  user: IUser;
}): Promise<
  | { ok: true; session: RealtimePipelineSessionResponse }
  | { ok: false; message: string; status: 400 | 403 }
> {
  const stageError =
    (await validatePipelineStage({
      env,
      model: request.input.model,
      name: "Input",
      provider: request.input.provider,
      user,
    })) ??
    (await validatePipelineStage({
      env,
      model: request.reasoning.model,
      name: "Reasoning",
      provider: request.reasoning.provider,
      user,
    })) ??
    (await validatePipelineStage({
      env,
      model: request.output.model,
      name: "Output",
      provider: request.output.provider,
      user,
    }));

  if (stageError) {
    return { ok: false, message: stageError.message, status: stageError.status };
  }

  const accessibleInputModel = await getAccessibleRealtimeModel({
    env,
    model: request.input.model,
    provider: request.input.provider,
    user,
  });

  if (!accessibleInputModel) {
    return { ok: false, message: "Input model access changed", status: 403 };
  }

  const realtimeProvider = getRealtimeProvider(request.input.provider, { env, user });
  const rawInputSession = await realtimeProvider.createSession({
    delay: request.delay,
    env,
    credentialAuthority: accessibleInputModel.credentialAuthority,
    language: request.language,
    model: request.input.model,
    outputModalities: ["text"],
    inputModalities: ["audio"],
    transport: "websocket",
    type: "transcription",
    user,
  });
  const inputSession = realtimeSessionResponseSchema.parse(rawInputSession);

  return {
    ok: true,
    session: {
      id: generateId(),
      object: "realtime.pipeline.session",
      type: "pipeline",
      live_mode: "composed",
      input: {
        ...request.input,
        session: inputSession,
      },
      reasoning: request.reasoning,
      output: request.output,
      latency_profile: request.latency_profile ?? "balanced",
    },
  };
}
