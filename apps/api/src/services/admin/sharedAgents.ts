import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { SharedAgentRepository } from "~/repositories/SharedAgentRepository";
import { UserRepository } from "~/repositories/UserRepository";
import {
  sendAgentFeaturedNotification,
  sendAgentModerationNotification,
} from "~/services/notifications";

const logger = getLogger({ prefix: "services/admin/sharedAgents" });

export interface FeaturedAgentResult {
  success: boolean;
  data?: {
    featured: boolean;
  };
  error?: string;
}

export interface ModeratedAgentResult {
  success: boolean;
  data?: {
    is_public: boolean;
    reason?: string;
  };
  error?: string;
}

export async function setAgentFeaturedStatus(
  env: IEnv,
  agentId: string,
  featured: boolean,
  moderator?: IUser,
): Promise<FeaturedAgentResult> {
  const repo = new SharedAgentRepository(env);

  try {
    const sharedAgent = await repo.getSharedAgentById(agentId);
    if (!sharedAgent) {
      return {
        success: false,
        error: "Shared agent not found",
      };
    }

    await repo.setFeatured(agentId, featured);

    if (featured) {
      const userRepo = new UserRepository(env);
      const agentOwner = await userRepo.getUserById(sharedAgent.user_id);

      if (agentOwner?.email) {
        await sendAgentFeaturedNotification(
          env,
          agentOwner.email,
          agentOwner.name || "User",
          {
            agentName: sharedAgent.name,
            agentId: sharedAgent.id,
            isFeatured: featured,
            moderatorName: moderator.name,
          },
        );
      }
    }

    return {
      success: true,
      data: { featured },
    };
  } catch (error) {
    logger.error("Failed to update featured status", {
      agentId,
      featured,
      error,
    });

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update featured status",
    };
  }
}

export async function moderateAgent(
  env: IEnv,
  agentId: string,
  isPublic: boolean,
  reason?: string,
  moderator?: IUser,
): Promise<ModeratedAgentResult> {
  const repo = new SharedAgentRepository(env);

  try {
    const sharedAgent = await repo.getSharedAgentById(agentId);
    if (!sharedAgent) {
      return {
        success: false,
        error: "Shared agent not found",
      };
    }

    await repo.moderateAgent(agentId, isPublic);

    const userRepo = new UserRepository(env);
    const agentOwner = await userRepo.getUserById(sharedAgent.user_id);

    if (agentOwner?.email) {
      await sendAgentModerationNotification(
        env,
        agentOwner.email,
        agentOwner.name || "User",
        {
          agentName: sharedAgent.name,
          agentId: sharedAgent.id,
          isApproved: isPublic,
          reason,
          moderatorName: moderator.name,
        },
      );
    }

    return {
      success: true,
      data: { is_public: isPublic, reason },
    };
  } catch (error) {
    logger.error("Failed to moderate agent", {
      agentId,
      isPublic,
      reason,
      error,
    });

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to moderate agent",
    };
  }
}

export async function getAllSharedAgentsForAdmin(
  env: IEnv,
): Promise<Record<string, unknown>[]> {
  const repo = new SharedAgentRepository(env);
  const agents = await repo.getAllSharedAgentsForAdmin({});
  return agents as unknown as Record<string, unknown>[];
}
