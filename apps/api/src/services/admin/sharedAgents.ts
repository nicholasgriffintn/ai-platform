import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { getLogger } from "~/utils/logger";
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

export async function setAgentFeaturedStatus({
	context,
	env,
	agentId,
	featured,
	moderator,
}: {
	context?: ServiceContext;
	env?: IEnv;
	agentId: string;
	featured: boolean;
	moderator?: IUser;
}): Promise<FeaturedAgentResult> {
	const serviceContext = resolveServiceContext({ context, env });

	try {
		const sharedAgent =
			await serviceContext.repositories.sharedAgents.getSharedAgentById(
				agentId,
			);
		if (!sharedAgent) {
			return {
				success: false,
				error: "Shared agent not found",
			};
		}

		await serviceContext.repositories.sharedAgents.setFeatured(
			agentId,
			featured,
		);

		if (featured) {
			const agentOwner = await serviceContext.repositories.users.getUserById(
				sharedAgent.user_id,
			);

			if (agentOwner?.email) {
				await sendAgentFeaturedNotification(
					serviceContext.env,
					agentOwner.email,
					agentOwner.name || "User",
					{
						agentName: sharedAgent.name,
						agentId: sharedAgent.id,
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

export async function moderateAgent({
	context,
	env,
	agentId,
	isPublic,
	reason,
	moderator,
}: {
	context?: ServiceContext;
	env?: IEnv;
	agentId: string;
	isPublic: boolean;
	reason?: string;
	moderator?: IUser;
}): Promise<ModeratedAgentResult> {
	const serviceContext = resolveServiceContext({ context, env });

	try {
		const sharedAgent =
			await serviceContext.repositories.sharedAgents.getSharedAgentById(
				agentId,
			);
		if (!sharedAgent) {
			return {
				success: false,
				error: "Shared agent not found",
			};
		}

		await serviceContext.repositories.sharedAgents.moderateAgent(
			agentId,
			isPublic,
		);

		const agentOwner = await serviceContext.repositories.users.getUserById(
			sharedAgent.user_id,
		);

		if (agentOwner?.email) {
			await sendAgentModerationNotification(
				serviceContext.env,
				agentOwner.email,
				agentOwner.name || "User",
				{
					agentName: sharedAgent.name,
					agentId: sharedAgent.id,
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

export async function getAllSharedAgentsForAdmin({
	context,
	env,
}: {
	context?: ServiceContext;
	env?: IEnv;
}): Promise<Record<string, unknown>[]> {
	const serviceContext = resolveServiceContext({ context, env });
	const agents =
		await serviceContext.repositories.sharedAgents.getAllSharedAgentsForAdmin(
			{},
		);
	return agents as unknown as Record<string, unknown>[];
}
