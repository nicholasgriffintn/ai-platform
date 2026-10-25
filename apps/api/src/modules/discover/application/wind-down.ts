import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DISCOVER_CAPABILITY_ID,
  DISCOVER_WIND_DOWN_KIND,
  discoverWindDownContentSchema,
  discoverWindDownDraftSchema,
  type CreateDiscoverWindDown,
  type DiscoverWindDown,
  type DiscoverWindDownContent,
} from "@ngriffin_uk/polychat-schemas";
import { humaniseIdentifier, isRecord } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import { fetchFollowingSafeRedirects } from "@ngriffin_uk/polychat-utility-server/http";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { getPrivateObjectResponse } from "~/infrastructure/storage/read-resource";
import { narratePassages } from "~/modules/audio/application/narration";
import { DISCOVER_MODEL_TIER } from "~/modules/discover/domain/settings";
import { generateMusic } from "~/modules/generate/application/music";
import { generateTierObject } from "~/modules/models/application/tier-object";
import { readOutputContent } from "~/modules/outputs/application/content";
import {
  OutputRepository,
  type OutputRecord,
} from "~/modules/outputs/infrastructure/OutputRepository";

import { publishDiscoverChanged } from "./events";
import { enqueueDiscoverJob } from "./jobs";

const logger = getLogger({ prefix: "discover/wind-down" });

function stepAudioKey(windDownId: string, step: number): string {
  return `outputs/${windDownId}/steps/${step}.mp3`;
}

function ambientKey(windDownId: string): string {
  return `outputs/${windDownId}/ambient`;
}

const AMBIENT_SECONDS = 90;

const AMBIENT_PROMPTS: Record<DiscoverWindDownContent["kind"], string> = {
  breathing:
    "Slow ambient pad for a breathing exercise at night, soft warm synth swells rising and falling every ten seconds, no drums, no vocals, no melody, seamless loop",
  body_scan:
    "Gentle spacious ambient drone for a body scan meditation, soft low strings and distant chimes, no drums, no vocals, very slow, seamless loop",
  unwind:
    "Calm late-evening ambient music, soft felt piano notes over a warm pad, no drums, no vocals, unhurried, seamless loop",
};

async function makeAmbientBed(
  context: ServiceContext,
  windDownId: string,
  kind: DiscoverWindDownContent["kind"],
): Promise<boolean> {
  const user = context.requireUser();
  const result = await generateMusic({
    completion_id: `wind_down_${windDownId}`,
    app_url: context.env.APP_BASE_URL,
    context,
    user,
    args: { prompt: AMBIENT_PROMPTS[kind], duration: AMBIENT_SECONDS },
  });
  const url = isRecord(result.data) && typeof result.data.url === "string" ? result.data.url : null;

  if (result.status !== "success" || !url) {
    logger.warn("Wind down music could not be made", { windDownId, reason: result.content });

    return false;
  }

  const response = await fetchFollowingSafeRedirects(url);

  if (!response.ok) {
    return false;
  }

  await StorageService.forPrivateAssets(context).uploadObject(
    ambientKey(windDownId),
    new Uint8Array(await response.arrayBuffer()),
    { httpMetadata: { contentType: response.headers.get("content-type") ?? "audio/mpeg" } },
  );

  return true;
}

async function requireWindDown(context: ServiceContext, windDownId: string) {
  const user = context.requireUser();
  const record = await context.repositories
    .get(OutputRepository)
    .getPersonalOutput(user.id, windDownId);
  const content = readOutputContent(record, DISCOVER_WIND_DOWN_KIND, discoverWindDownContentSchema);

  if (!record || !content) {
    throw new AssistantError("Wind down not found", ErrorType.NOT_FOUND, 404);
  }

  return { record, content };
}

export async function latestDiscoverWindDownId(
  context: ServiceContext,
  userId: number,
): Promise<string | null> {
  const [latest] = await context.repositories
    .get(OutputRepository)
    .listPersonalOutputs(userId, DISCOVER_CAPABILITY_ID, {
      kind: DISCOVER_WIND_DOWN_KIND,
      limit: 1,
    });

  return latest?.id ?? null;
}

export async function startDiscoverWindDown(
  context: ServiceContext,
  input: CreateDiscoverWindDown,
): Promise<DiscoverWindDown> {
  const user = context.requireUser();
  const content: DiscoverWindDownContent = {
    format: "wind_down",
    kind: input.kind,
    minutes: input.minutes,
    title: `${humaniseIdentifier(input.kind)}, ${input.minutes} minutes`,
    steps: [],
    status: "pending",
    ambient: false,
  };
  const record = await context.repositories.get(OutputRepository).createOutput({
    createdByUserId: user.id,
    capabilityId: DISCOVER_CAPABILITY_ID,
    kind: DISCOVER_WIND_DOWN_KIND,
    title: content.title,
    status: "pending",
    sensitivity: "personal",
    content,
  });

  await enqueueDiscoverJob(context, { job: "wind_down", windDownId: record.id });

  return { ...content, id: record.id };
}

async function saveWindDown(
  context: ServiceContext,
  record: OutputRecord,
  content: DiscoverWindDownContent,
): Promise<OutputRecord> {
  const updated = await context.repositories.get(OutputRepository).updateOutput(record.id, {
    title: content.title,
    status:
      content.status === "failed" ? "failed" : content.status === "ready" ? "ready" : "pending",
    content,
    expectedRevision: record.revision,
    updatedByUserId: context.requireUser().id,
  });

  await publishDiscoverChanged(context);

  return updated;
}

export async function renderDiscoverWindDown(
  context: ServiceContext,
  windDownId: string,
): Promise<void> {
  const { record, content } = await requireWindDown(context, windDownId);

  if (content.status !== "pending") {
    return;
  }

  try {
    const script = await generateTierObject(context, {
      tier: DISCOVER_MODEL_TIER,
      name: "discover_wind_down",
      schema: discoverWindDownDraftSchema,
      system: renderPrompt("discover/wind-down/script", {
        kind: humaniseIdentifier(content.kind).toLowerCase(),
        minutes: String(content.minutes),
      }),
      material: `Write a ${content.minutes}-minute ${humaniseIdentifier(content.kind).toLowerCase()} session.`,
    });
    const storage = StorageService.forPrivateAssets(context);
    let ambient = false;
    let savedAmbient = false;
    const ambientReady = makeAmbientBed(context, windDownId, content.kind)
      .then((made) => {
        ambient = made;

        return made;
      })
      .catch((error: unknown) => {
        logger.warn("Wind down music failed", {
          windDownId,
          error_message: getErrorMessage(error),
        });

        return false;
      });
    let steps: DiscoverWindDownContent["steps"] = script.steps.map((step) => ({
      ...step,
      audio: false,
    }));
    let saved = await saveWindDown(context, record, {
      ...content,
      title: script.title,
      steps,
      status: "speaking",
    });

    await narratePassages(
      context,
      script.steps.map((step) => step.text),
      {
        language: "en",
        onPassage: async (index, audio) => {
          await storage.uploadObject(stepAudioKey(windDownId, index), audio, {
            httpMetadata: { contentType: "audio/mpeg" },
          });
          steps = steps.map((entry, position) =>
            position === index ? { ...entry, audio: true } : entry,
          );
          saved = await saveWindDown(context, saved, {
            ...content,
            title: script.title,
            steps,
            ambient,
            status: index === script.steps.length - 1 ? "ready" : "speaking",
          });
          savedAmbient = ambient;
        },
      },
    );

    if ((await ambientReady) && !savedAmbient) {
      await saveWindDown(context, saved, {
        ...content,
        title: script.title,
        steps,
        ambient: true,
        status: "ready",
      });
    }
  } catch (error) {
    logger.error("Wind down failed", { windDownId, error_message: getErrorMessage(error) });
    const latest = await requireWindDown(context, windDownId);

    await saveWindDown(context, latest.record, { ...latest.content, status: "failed" });
  }
}

export async function readDiscoverWindDown(
  context: ServiceContext,
  windDownId: string,
): Promise<DiscoverWindDown> {
  const { record, content } = await requireWindDown(context, windDownId);

  return { ...content, id: record.id };
}

export async function readWindDownAmbient(
  context: ServiceContext,
  windDownId: string,
  rangeHeader?: string | null,
): Promise<Response> {
  await requireWindDown(context, windDownId);

  return getPrivateObjectResponse(
    context,
    ambientKey(windDownId),
    { filename: "ambient", mimeType: "audio/mpeg" },
    rangeHeader,
  );
}

export async function readWindDownStepAudio(
  context: ServiceContext,
  windDownId: string,
  step: number,
  rangeHeader?: string | null,
): Promise<Response> {
  await requireWindDown(context, windDownId);

  return getPrivateObjectResponse(
    context,
    stepAudioKey(windDownId, step),
    { filename: `step-${step + 1}.mp3`, mimeType: "audio/mpeg" },
    rangeHeader,
  );
}
