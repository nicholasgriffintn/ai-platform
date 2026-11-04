import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import type z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { readOutputContent } from "~/modules/outputs/application/content";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { WATCHING_CAPABILITY_ID } from "~/modules/watching/domain/shelf";

const SAVE_ATTEMPTS = 5;

export interface WatchingDocument<TContent> {
  kind: string;
  group: string;
  title: string;
  idPrefix: string;
  schema: z.ZodType<TContent>;
  empty: () => TContent;
}

function readRecord<TContent>(context: ServiceContext, document: WatchingDocument<TContent>) {
  return context.repositories
    .get(OutputRepository)
    .getPersonalOutputByGroup(context.requireUser().id, document.group, document.kind);
}

function readContent<TContent>(
  userId: number,
  document: WatchingDocument<TContent>,
  record: Awaited<ReturnType<typeof readRecord>>,
): TContent {
  if (!record) {
    return document.empty();
  }

  const content = readOutputContent(record, document.kind, document.schema);

  if (!content || !ownsResource(userId, record.created_by_user_id) || record.project_id !== null) {
    throw new AssistantError(`${document.title} could not be read`, ErrorType.CONFIGURATION_ERROR);
  }

  return content;
}

export async function readWatchingDocument<TContent>(
  context: ServiceContext,
  document: WatchingDocument<TContent>,
): Promise<TContent> {
  return readContent(context.requireUser().id, document, await readRecord(context, document));
}

export async function updateWatchingDocument<TContent>(
  context: ServiceContext,
  document: WatchingDocument<TContent>,
  change: (content: TContent) => TContent,
): Promise<TContent> {
  const user = context.requireUser();
  const outputs = context.repositories.get(OutputRepository);

  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
    const record = await readRecord(context, document);
    const previous = readContent(user.id, document, record);
    const content = document.schema.parse(change(previous));

    if (JSON.stringify(previous) === JSON.stringify(content)) {
      return content;
    }

    try {
      if (record) {
        await outputs.updateOutput(record.id, {
          content,
          expectedRevision: record.revision,
          updatedByUserId: user.id,
        });
      } else {
        await outputs.createOutput({
          id: `${document.idPrefix}_${user.id}`,
          createdByUserId: user.id,
          capabilityId: WATCHING_CAPABILITY_ID,
          groupId: document.group,
          kind: document.kind,
          title: document.title,
          sensitivity: "personal",
          content,
        });
      }

      return content;
    } catch (error) {
      const conflict = error instanceof AssistantError && error.type === ErrorType.CONFLICT_ERROR;

      if (!conflict && !(!record && (await readRecord(context, document)))) {
        throw error;
      }
    }
  }

  throw new AssistantError(
    `${document.title} kept changing while saving`,
    ErrorType.CONFLICT_ERROR,
    409,
  );
}
