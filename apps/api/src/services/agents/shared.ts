import type { ServiceContext } from "~/lib/context/serviceContext";
import type {
	SharedAgentWithAuthor,
	SharedAgent,
	SharedAgentFilters,
	CreateSharedAgentParams,
	AgentInstall,
	AgentRating,
} from "~/repositories/SharedAgentRepository";
import type { Agent } from "~/lib/database/schema";

const ensureDb = (context: ServiceContext) => {
	context.ensureDatabase();
	return context.repositories.sharedAgents;
};

export const getSharedAgents = async (
	context: ServiceContext,
	filters: SharedAgentFilters = {},
): Promise<SharedAgentWithAuthor[]> => {
	return ensureDb(context).getSharedAgents(filters);
};

export const getFeaturedAgents = async (
	context: ServiceContext,
	limit = 10,
): Promise<SharedAgentWithAuthor[]> => {
	return ensureDb(context).getFeaturedAgents(limit);
};

export const getSharedAgentById = async (
	context: ServiceContext,
	id: string,
): Promise<SharedAgentWithAuthor | null> => {
	return ensureDb(context).getSharedAgentById(id);
};

export const getSharedAgentByAgentId = async (
	context: ServiceContext,
	agentId: string,
): Promise<SharedAgent | null> => {
	return ensureDb(context).getSharedAgentByAgentId(agentId);
};

export const getAllSharedAgentsForAdmin = async (
	context: ServiceContext,
	filters: SharedAgentFilters = {},
): Promise<SharedAgentWithAuthor[]> => {
	return ensureDb(context).getAllSharedAgentsForAdmin(filters);
};

export const installSharedAgent = async (
	context: ServiceContext,
	sharedAgentId: string,
	userId?: number,
): Promise<{ agent: Agent; install: AgentInstall }> => {
	const repo = ensureDb(context);
	const id = userId ?? context.requireUser().id;
	return repo.installAgent(id, sharedAgentId);
};

export const uninstallSharedAgent = async (
	context: ServiceContext,
	agentId: string,
	userId?: number,
): Promise<void> => {
	const repo = ensureDb(context);
	const id = userId ?? context.requireUser().id;
	await repo.uninstallAgent(id, agentId);
};

export const rateSharedAgent = async (
	context: ServiceContext,
	sharedAgentId: string,
	rating: number,
	review?: string,
	userId?: number,
): Promise<AgentRating> => {
	const repo = ensureDb(context);
	const id = userId ?? context.requireUser().id;
	return repo.rateAgent(id, sharedAgentId, rating, review);
};

export const getSharedAgentRatings = async (
	context: ServiceContext,
	sharedAgentId: string,
	limit = 10,
): Promise<(AgentRating & { author_name: string })[]> => {
	return ensureDb(context).getAgentRatings(sharedAgentId, limit);
};

export const updateSharedAgent = async (
	context: ServiceContext,
	sharedAgentId: string,
	updates: Partial<
		Pick<
			SharedAgent,
			"name" | "description" | "avatar_url" | "category" | "tags"
		>
	>,
	userId?: number,
): Promise<void> => {
	const repo = ensureDb(context);
	const id = userId ?? context.requireUser().id;
	await repo.updateSharedAgent(id, sharedAgentId, updates);
};

export const deleteSharedAgent = async (
	context: ServiceContext,
	sharedAgentId: string,
	userId?: number,
): Promise<void> => {
	const repo = ensureDb(context);
	const id = userId ?? context.requireUser().id;
	await repo.deleteSharedAgent(id, sharedAgentId);
};

export const setFeaturedStatus = async (
	context: ServiceContext,
	sharedAgentId: string,
	featured: boolean,
): Promise<void> => {
	await ensureDb(context).setFeatured(sharedAgentId, featured);
};

export const moderateSharedAgent = async (
	context: ServiceContext,
	sharedAgentId: string,
	isPublic: boolean,
): Promise<void> => {
	await ensureDb(context).moderateAgent(sharedAgentId, isPublic);
};

export const getSharedAgentCategories = async (
	context: ServiceContext,
): Promise<string[]> => {
	return ensureDb(context).getCategories();
};

export const getSharedAgentPopularTags = async (
	context: ServiceContext,
	limit = 20,
): Promise<string[]> => {
	return ensureDb(context).getPopularTags(limit);
};

export const shareAgent = async (
	context: ServiceContext,
	params: CreateSharedAgentParams,
	userId?: number,
): Promise<SharedAgent> => {
	const repo = ensureDb(context);
	const id = userId ?? context.requireUser().id;
	return repo.shareAgent(id, params);
};
