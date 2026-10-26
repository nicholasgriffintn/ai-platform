import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import { synthesisResourceSql } from "~/infrastructure/database/resource-storage";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "modules/memory/schedule" });

const MIN_NEW_MEMORIES_FOR_SYNTHESIS = 5;

export async function scheduleDailySynthesis(env: IEnv): Promise<void> {
  try {
    const result = await env.DB.prepare(
      `SELECT u.id AS id, COUNT(s.id) AS new_memory_count
       FROM user u
       INNER JOIN scoped_configuration us ON u.id = us.user_id AND us.kind = 'preferences'
       LEFT JOIN (
         SELECT user_id, MAX(created_at) AS created_at
         FROM ${synthesisResourceSql} memory_syntheses
         WHERE namespace = 'global' AND is_active = 1
         GROUP BY user_id
       ) ms ON ms.user_id = u.id
       LEFT JOIN resource memory_document
         ON memory_document.resource_type = 'memory' AND memory_document.kind = 'memory'
        AND memory_document.scope_type = 'personal' AND memory_document.scope_id = CAST(u.id AS TEXT)
        AND memory_document.deleted_at IS NULL
       LEFT JOIN resource_revision s
         ON s.resource_type = 'memory' AND s.document_id = memory_document.id
        AND (ms.created_at IS NULL OR s.created_at > ms.created_at)
       WHERE json_extract(us.payload, '$.memories_save_enabled') = 1
       GROUP BY u.id`,
    ).all();

    const users = result.results as Array<{ id: number; new_memory_count: number }>;

    if (!users || users.length === 0) {
      logger.info("No users with memories enabled for daily synthesis");

      return;
    }

    const taskService = new TaskService(env, new TaskRepository(env));
    let scheduledCount = 0;

    for (const user of users) {
      if (user.new_memory_count < MIN_NEW_MEMORIES_FOR_SYNTHESIS) {
        continue;
      }

      try {
        await taskService.enqueueTask({
          task_type: "memory_synthesis",
          user_id: user.id,
          task_data: { namespace: "global" },
          priority: 5,
        });

        scheduledCount++;
      } catch (error) {
        logger.error(`Failed to schedule synthesis for user ${user.id}:`, error);
      }
    }

    logger.info(
      `Scheduled daily synthesis for ${scheduledCount} users (out of ${users.length} total)`,
    );
  } catch (error) {
    logger.error("Failed to schedule daily synthesis:", error);
    throw error;
  }
}
