import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  STARTER_NOTE_CONTENT,
  STARTER_NOTE_TITLE,
  STARTER_NOTEBOOK_NAME,
} from "~/modules/notebooks/domain/starter";
import type { IUser } from "~/types";

import { createNotebook, createNotebookNote } from "./notebooks";

const logger = getLogger({ prefix: "notebooks/starter" });

export async function seedStarterNotebook(context: ServiceContext, user: IUser): Promise<void> {
  const scoped = createServiceContext({
    env: context.env,
    user,
    requestId: context.requestId,
    waitUntil: context.waitUntil,
    outboundGateway: context.outboundGateway,
    executionCtx: context.executionCtx,
  });

  try {
    const notebook = await createNotebook(scoped, {
      name: STARTER_NOTEBOOK_NAME,
      scope: { kind: "personal" },
    });

    await createNotebookNote(scoped, notebook.id, {
      title: STARTER_NOTE_TITLE,
      content: STARTER_NOTE_CONTENT,
    });
  } catch (error) {
    logger.warn("Starter notebook was not created", { error, userId: user.id });
  }
}
