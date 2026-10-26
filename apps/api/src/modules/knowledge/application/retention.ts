import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { createRepositories } from "~/infrastructure/database/repositories";
import { KnowledgeDocumentRepository } from "~/modules/knowledge/infrastructure/KnowledgeDocumentRepository";
import { deleteSource } from "~/modules/sources/application/sources";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "knowledge/retention" });

export async function removeExpiredKnowledge(env: IEnv): Promise<number> {
  const repositories = createRepositories(env);
  const expired = await repositories.get(KnowledgeDocumentRepository).listExpired();
  let removed = 0;

  for (const source of expired) {
    const user = await repositories.get(UserRepository).getUserById(source.created_by_user_id);

    if (!user) {
      continue;
    }

    try {
      await deleteSource(createServiceContext({ env, user }), user.id, source.id);
      removed += 1;
    } catch (error) {
      logger.warn("An expired knowledge document could not be removed", {
        source_id: source.id,
        error_message: getErrorMessage(error),
      });
    }
  }

  return removed;
}
