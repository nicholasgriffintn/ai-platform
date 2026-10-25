import {
  DISCOVER_CAPABILITY_ID,
  DISCOVER_EDITION_KIND,
  discoverEditionContentSchema,
  type DiscoverEdition,
  type DiscoverEditionContent,
  type DiscoverResponse,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  withExecutionRunContext,
  type ServiceContext,
} from "~/infrastructure/context/serviceContext";
import { discoverEditionGroupId } from "~/modules/discover/domain/edition";
import { collectCardSignals } from "~/modules/discover/domain/feedback";
import {
  OutputRepository,
  type OutputRecord,
} from "~/modules/outputs/infrastructure/OutputRepository";

import { publishDiscoverChanged } from "./events";
import { listDiscoverFeedback } from "./feedback";
import { listDiscoverFollows } from "./follows";
import { readDiscoverSettings } from "./settings";
import { latestDiscoverWindDownId } from "./wind-down";

export interface StoredDiscoverEdition {
  id: string;
  revision: number;
  content: DiscoverEditionContent;
}

function readStoredEdition(record: OutputRecord | null): StoredDiscoverEdition | null {
  if (!record || record.kind !== DISCOVER_EDITION_KIND || record.project_id !== null) {
    return null;
  }

  const parsed = discoverEditionContentSchema.safeParse(safeParseJson(record.content));

  return parsed.success ? { id: record.id, revision: record.revision, content: parsed.data } : null;
}

export async function listRecentDiscoverEditions(
  context: ServiceContext,
  userId: number,
  limit: number,
): Promise<StoredDiscoverEdition[]> {
  const records = await context.repositories
    .get(OutputRepository)
    .listPersonalOutputs(userId, DISCOVER_CAPABILITY_ID, { kind: DISCOVER_EDITION_KIND, limit });

  return records.flatMap((record) => {
    const edition = readStoredEdition(record);

    return edition ? [edition] : [];
  });
}

export function withEditionRun(
  context: ServiceContext,
  edition: StoredDiscoverEdition,
): ServiceContext {
  return edition.content.runId && !context.executionRunId
    ? withExecutionRunContext(context, edition.content.runId)
    : context;
}

export async function requireDiscoverEdition(
  context: ServiceContext,
  userId: number,
  editionId: string,
): Promise<StoredDiscoverEdition> {
  const edition = readStoredEdition(
    await context.repositories.get(OutputRepository).getPersonalOutput(userId, editionId),
  );

  if (!edition) {
    throw new AssistantError("Discover edition not found", ErrorType.NOT_FOUND, 404);
  }

  return edition;
}

async function presentEdition(
  context: ServiceContext,
  userId: number,
  edition: StoredDiscoverEdition | null,
): Promise<DiscoverEdition | null> {
  if (!edition) {
    return null;
  }

  const feedback = collectCardSignals(await listDiscoverFeedback(context, userId), edition.id);

  return { ...edition.content, id: edition.id, feedback };
}

export async function readDiscover(context: ServiceContext): Promise<DiscoverResponse> {
  const user = context.requireUser();
  const [settings, [latest], follows, windDownId] = await Promise.all([
    readDiscoverSettings(context),
    listRecentDiscoverEditions(context, user.id, 1),
    listDiscoverFollows(context, user.id),
    latestDiscoverWindDownId(context, user.id),
  ]);

  return {
    settings,
    follows,
    windDownId,
    edition: await presentEdition(context, user.id, latest ?? null),
  };
}

export async function readDiscoverEditionByDate(
  context: ServiceContext,
  date: string,
): Promise<DiscoverEdition> {
  const user = context.requireUser();
  const edition = readStoredEdition(
    await context.repositories
      .get(OutputRepository)
      .getPersonalOutputByGroup(user.id, discoverEditionGroupId(date), DISCOVER_EDITION_KIND),
  );
  const presented = await presentEdition(context, user.id, edition);

  if (!presented) {
    throw new AssistantError("No Discover edition for that day", ErrorType.NOT_FOUND, 404);
  }

  return presented;
}

export async function saveDiscoverEdition(
  context: ServiceContext,
  userId: number,
  content: DiscoverEditionContent,
): Promise<StoredDiscoverEdition> {
  const outputs = context.repositories.get(OutputRepository);
  const checked = discoverEditionContentSchema.safeParse(content);

  if (!checked.success) {
    const issue = checked.error.issues[0];

    throw new AssistantError(
      `Discover edition is not valid at ${issue?.path.join(".") || "root"}: ${issue?.message ?? "unknown"}`,
      ErrorType.INTERNAL_ERROR,
    );
  }

  const groupId = discoverEditionGroupId(content.date, content.edition);
  const existing = await outputs.getPersonalOutputByGroup(userId, groupId, DISCOVER_EDITION_KIND);
  const previous = readStoredEdition(existing)?.content;
  const title = `Discover, ${content.date}`;
  const record = existing
    ? await outputs.updateOutput(existing.id, {
        title,
        status: "ready",
        content: {
          ...content,
          episodeId: previous?.episodeId,
          weekSourceId: previous?.weekSourceId,
        },
        expectedRevision: existing.revision,
        updatedByUserId: userId,
      })
    : await outputs.createOutput({
        createdByUserId: userId,
        capabilityId: DISCOVER_CAPABILITY_ID,
        groupId,
        kind: DISCOVER_EDITION_KIND,
        title,
        status: "ready",
        sensitivity: "personal",
        content,
      });
  const stored = readStoredEdition(record);

  if (!stored) {
    throw new AssistantError("Discover edition could not be saved", ErrorType.INTERNAL_ERROR);
  }

  await publishDiscoverChanged(context);

  return stored;
}
