import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import {
  sendTeammateFeaturedNotification,
  sendTeammateModerationNotification,
} from "~/services/notifications";
import type { IEnv, IUser } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/admin/sharedAgents" });

export interface FeaturedTeammateResult {
  success: boolean;
  data?: {
    featured: boolean;
  };
  error?: string;
}

export interface ModeratedTeammateResult {
  success: boolean;
  data?: {
    is_public: boolean;
    reason?: string;
  };
  error?: string;
}

export async function setTeammateFeaturedStatus({
  context,
  env,
  teammateId,
  featured,
  moderator,
}: {
  context?: ServiceContext;
  env?: IEnv;
  teammateId: string;
  featured: boolean;
  moderator?: IUser;
}): Promise<FeaturedTeammateResult> {
  const serviceContext = resolveServiceContext({ context, env });

  try {
    const sharedAgent =
      await serviceContext.repositories.sharedAgents.getSharedTeammateById(teammateId);

    if (!sharedAgent) {
      return {
        success: false,
        error: "Shared agent not found",
      };
    }

    await serviceContext.repositories.sharedAgents.setFeatured(teammateId, featured);

    if (featured) {
      const teammateOwner = await serviceContext.repositories.users.getUserById(
        sharedAgent.user_id,
      );

      if (teammateOwner?.email) {
        await sendTeammateFeaturedNotification(
          serviceContext.env,
          teammateOwner.email,
          teammateOwner.name || "User",
          {
            teammateName: sharedAgent.name,
            teammateId: sharedAgent.id,
            isFeatured: featured,
            moderatorName: moderator?.name || "Admin",
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
      teammateId,
      featured,
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update featured status",
    };
  }
}

export async function moderateTeammate({
  context,
  env,
  teammateId,
  isPublic,
  reason,
  moderator,
}: {
  context?: ServiceContext;
  env?: IEnv;
  teammateId: string;
  isPublic: boolean;
  reason?: string;
  moderator?: IUser;
}): Promise<ModeratedTeammateResult> {
  const serviceContext = resolveServiceContext({ context, env });

  try {
    const sharedAgent =
      await serviceContext.repositories.sharedAgents.getSharedTeammateById(teammateId);

    if (!sharedAgent) {
      return {
        success: false,
        error: "Shared agent not found",
      };
    }

    await serviceContext.repositories.sharedAgents.moderateTeammate(teammateId, isPublic);

    const teammateOwner = await serviceContext.repositories.users.getUserById(sharedAgent.user_id);

    if (teammateOwner?.email) {
      await sendTeammateModerationNotification(
        serviceContext.env,
        teammateOwner.email,
        teammateOwner.name || "User",
        {
          teammateName: sharedAgent.name,
          teammateId: sharedAgent.id,
          isApproved: isPublic,
          reason,
          moderatorName: moderator?.name || "Admin",
        },
      );
    }

    return {
      success: true,
      data: { is_public: isPublic, reason },
    };
  } catch (error) {
    logger.error("Failed to moderate agent", {
      teammateId,
      isPublic,
      reason,
      error,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to moderate agent",
    };
  }
}

export async function getAllSharedTeammatesForAdmin({
  context,
  env,
}: {
  context?: ServiceContext;
  env?: IEnv;
}): Promise<Record<string, unknown>[]> {
  const serviceContext = resolveServiceContext({ context, env });
  const agents = await serviceContext.repositories.sharedAgents.getAllSharedTeammatesForAdmin({});

  return agents as unknown as Record<string, unknown>[];
}
