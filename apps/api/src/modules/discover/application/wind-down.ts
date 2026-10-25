import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DISCOVER_CAPABILITY_ID,
  DISCOVER_WIND_DOWN_KIND,
  discoverWindDownContentSchema,
  type CreateDiscoverWindDown,
  type DiscoverWindDown,
  type DiscoverWindDownContent,
} from "@ngriffin_uk/polychat-schemas";
import { humaniseIdentifier } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { getPrivateObjectResponse } from "~/infrastructure/storage/read-resource";
import { narratePassages } from "~/modules/audio/application/narration";
import {
  chooseStoryTopic,
  chooseWindDownBed,
  planWindDownStory,
} from "~/modules/discover/domain/wind-down";
import { readOutputContent } from "~/modules/outputs/application/content";
import {
  OutputRepository,
  type OutputRecord,
} from "~/modules/outputs/infrastructure/OutputRepository";

import { publishDiscoverChanged } from "./events";
import { listDiscoverFollows } from "./follows";
import { enqueueDiscoverJob } from "./jobs";
import { ensureWindDownBed, hasWindDownBed } from "./wind-down-beds";
import { readWindDownHighlights } from "./wind-down-context";
import { listRecentWindDowns } from "./wind-down-history";
import { writeWindDownScript, type WindDownScriptRequest } from "./wind-down-script";

const logger = getLogger({ prefix: "discover/wind-down" });

function stepAudioKey(windDownId: string, step: number): string {
  return `outputs/${windDownId}/steps/${step}.mp3`;
}

function describeTitle(content: Pick<DiscoverWindDownContent, "kind" | "minutes" | "bed">) {
  return content.kind === "sound"
    ? `${humaniseIdentifier(content.bed)}, ${content.minutes} minutes`
    : `${humaniseIdentifier(content.kind)}, ${content.minutes} minutes`;
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

async function planStory(
  context: ServiceContext,
  userId: number,
  input: CreateDiscoverWindDown,
  recent: Awaited<ReturnType<typeof listRecentWindDowns>>,
): Promise<Pick<DiscoverWindDownContent, "topic" | "part">> {
  if (input.kind !== "story") {
    return {};
  }

  const topic =
    input.topic ??
    chooseStoryTopic(
      (await listDiscoverFollows(context, userId)).map((follow) => follow.topic),
      recent,
    );
  const plan = planWindDownStory(topic, recent);

  return plan.topic ? { topic: plan.topic, part: plan.part } : {};
}

export async function startDiscoverWindDown(
  context: ServiceContext,
  input: CreateDiscoverWindDown,
): Promise<DiscoverWindDown> {
  const user = context.requireUser();

  if (input.kind === "read_back" && (await readWindDownHighlights(context, user.id)).length === 0) {
    throw new AssistantError(
      "There are no highlights to read back yet. Use Readwise for Discover in Discover settings.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const recent = await listRecentWindDowns(context, user.id);
  const bed = input.bed ?? chooseWindDownBed(input.kind, recent);
  const content: DiscoverWindDownContent = {
    format: "wind_down",
    kind: input.kind,
    minutes: input.minutes,
    title: describeTitle({ kind: input.kind, minutes: input.minutes, bed }),
    steps: [],
    status: input.kind === "sound" ? "ready" : "pending",
    bed,
    ambient: await hasWindDownBed(context, bed),
    ...(await planStory(context, user.id, input, recent)),
  };
  const record = await context.repositories.get(OutputRepository).createOutput({
    createdByUserId: user.id,
    capabilityId: DISCOVER_CAPABILITY_ID,
    kind: DISCOVER_WIND_DOWN_KIND,
    title: content.title,
    status: content.status === "ready" ? "ready" : "pending",
    sensitivity: "personal",
    content,
  });

  if (input.kind !== "sound" || !content.ambient) {
    await enqueueDiscoverJob(context, {
      job: "wind_down",
      windDownId: record.id,
      aboutToday: input.aboutToday,
      premise: input.premise,
      notes: input.notes,
    });
  }

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

function prepareBed(context: ServiceContext, content: DiscoverWindDownContent): Promise<boolean> {
  if (content.ambient) {
    return Promise.resolve(true);
  }

  return ensureWindDownBed(context, content.bed).catch((error: unknown) => {
    logger.warn("Wind down sound failed", {
      bed: content.bed,
      error_message: getErrorMessage(error),
    });

    return false;
  });
}

async function recordSound(context: ServiceContext, windDownId: string): Promise<void> {
  const { content } = await requireWindDown(context, windDownId);

  if (!(await prepareBed(context, content))) {
    return;
  }

  const latest = await requireWindDown(context, windDownId);

  await saveWindDown(context, latest.record, { ...latest.content, ambient: true });
}

export async function renderDiscoverWindDown(
  context: ServiceContext,
  windDownId: string,
  request: WindDownScriptRequest,
): Promise<void> {
  const { record, content } = await requireWindDown(context, windDownId);

  if (content.kind === "sound") {
    await recordSound(context, windDownId);

    return;
  }

  if (content.status !== "pending") {
    return;
  }

  let bedMade = false;
  const bedReady = prepareBed(context, content).then((made) => {
    bedMade = made;

    return made;
  });

  try {
    const script = await writeWindDownScript(context, windDownId, content, request);
    const storage = StorageService.forPrivateAssets(context);
    const written: DiscoverWindDownContent = {
      ...content,
      title: script.title,
      summary: script.summary,
      ...(script.parked ? { parked: script.parked } : {}),
      steps: script.steps.map((step) => ({ ...step, audio: false })),
    };
    let saved = await saveWindDown(context, record, { ...written, status: "speaking" });
    let current: DiscoverWindDownContent = { ...written, status: "speaking" };

    await narratePassages(
      context,
      script.steps.map((step) => step.text),
      {
        language: "en",
        onPassage: async (index, audio) => {
          await storage.uploadObject(stepAudioKey(windDownId, index), audio, {
            httpMetadata: { contentType: "audio/mpeg" },
          });
          current = {
            ...current,
            steps: current.steps.map((entry, position) =>
              position === index ? { ...entry, audio: true } : entry,
            ),
            status: index === script.steps.length - 1 ? "ready" : "speaking",
            ambient: current.ambient || bedMade,
          };
          saved = await saveWindDown(context, saved, current);
        },
      },
    );

    if ((await bedReady) && !current.ambient) {
      await saveWindDown(context, saved, { ...current, ambient: true });
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
