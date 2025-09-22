import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";
import { SharedAgentRepository } from "~/repositories/SharedAgentRepository";
import type {
  SharedAgentWithAuthor,
  SharedAgent,
  SharedAgentFilters,
  CreateSharedAgentParams,
  AgentInstall,
  AgentRating,
} from "~/repositories/SharedAgentRepository";
import type { Agent } from "~/lib/database/schema";

const logger = getLogger({ prefix: "services/agents/shared" });

/**
 * Get shared agents with filters
 * @param env The environment
 * @param filters The filters to apply
 * @returns Array of shared agents with author info
 */
export const getSharedAgents = async (
  env: IEnv,
  filters: SharedAgentFilters = {},
): Promise<SharedAgentWithAuthor[]> => {
  const repo = new SharedAgentRepository(env);
  return repo.getSharedAgents(filters);
};

/**
 * Get featured agents
 * @param env The environment
 * @param limit The number of agents to return
 * @returns Array of featured agents
 */
export const getFeaturedAgents = async (
  env: IEnv,
  limit = 10,
): Promise<SharedAgentWithAuthor[]> => {
  const repo = new SharedAgentRepository(env);
  return repo.getFeaturedAgents(limit);
};

/**
 * Get a shared agent by ID
 * @param env The environment
 * @param id The shared agent ID
 * @returns The shared agent with author info or null
 */
export const getSharedAgentById = async (
  env: IEnv,
  id: string,
): Promise<SharedAgentWithAuthor | null> => {
  const repo = new SharedAgentRepository(env);
  return repo.getSharedAgentById(id);
};

/**
 * Get a shared agent by agent ID
 * @param env The environment
 * @param agentId The agent ID
 * @returns The shared agent or null
 */
export const getSharedAgentByAgentId = async (
  env: IEnv,
  agentId: string,
): Promise<SharedAgent | null> => {
  const repo = new SharedAgentRepository(env);
  return repo.getSharedAgentByAgentId(agentId);
};

/**
 * Get all shared agents for admin (including non-public)
 * @param env The environment
 * @param filters The filters to apply
 * @returns Array of all shared agents with author info
 */
export const getAllSharedAgentsForAdmin = async (
  env: IEnv,
  filters: SharedAgentFilters = {},
): Promise<SharedAgentWithAuthor[]> => {
  const repo = new SharedAgentRepository(env);
  return repo.getAllSharedAgentsForAdmin(filters);
};

/**
 * Install a shared agent
 * @param env The environment
 * @param userId The user ID
 * @param sharedAgentId The shared agent ID
 * @returns The installed agent and install record
 */
export const installSharedAgent = async (
  env: IEnv,
  userId: number,
  sharedAgentId: string,
): Promise<{ agent: Agent; install: AgentInstall }> => {
  const repo = new SharedAgentRepository(env);
  return repo.installAgent(userId, sharedAgentId);
};

/**
 * Uninstall a shared agent
 * @param env The environment
 * @param userId The user ID
 * @param agentId The agent ID
 */
export const uninstallSharedAgent = async (
  env: IEnv,
  userId: number,
  agentId: string,
): Promise<void> => {
  const repo = new SharedAgentRepository(env);
  return repo.uninstallAgent(userId, agentId);
};

/**
 * Rate a shared agent
 * @param env The environment
 * @param userId The user ID
 * @param sharedAgentId The shared agent ID
 * @param rating The rating (1-5)
 * @param review Optional review text
 * @returns The rating record
 */
export const rateSharedAgent = async (
  env: IEnv,
  userId: number,
  sharedAgentId: string,
  rating: number,
  review?: string,
): Promise<AgentRating> => {
  const repo = new SharedAgentRepository(env);
  return repo.rateAgent(userId, sharedAgentId, rating, review);
};

/**
 * Get ratings for a shared agent
 * @param env The environment
 * @param sharedAgentId The shared agent ID
 * @param limit The number of ratings to return
 * @returns Array of ratings with author info
 */
export const getSharedAgentRatings = async (
  env: IEnv,
  sharedAgentId: string,
  limit = 10,
): Promise<(AgentRating & { author_name: string })[]> => {
  const repo = new SharedAgentRepository(env);
  return repo.getAgentRatings(sharedAgentId, limit);
};

/**
 * Update a shared agent
 * @param env The environment
 * @param userId The user ID
 * @param sharedAgentId The shared agent ID
 * @param updates The updates to apply
 */
export const updateSharedAgent = async (
  env: IEnv,
  userId: number,
  sharedAgentId: string,
  updates: Partial<
    Pick<
      SharedAgent,
      "name" | "description" | "avatar_url" | "category" | "tags"
    >
  >,
): Promise<void> => {
  const repo = new SharedAgentRepository(env);
  return repo.updateSharedAgent(userId, sharedAgentId, updates);
};

/**
 * Delete a shared agent
 * @param env The environment
 * @param userId The user ID
 * @param sharedAgentId The shared agent ID
 */
export const deleteSharedAgent = async (
  env: IEnv,
  userId: number,
  sharedAgentId: string,
): Promise<void> => {
  const repo = new SharedAgentRepository(env);
  return repo.deleteSharedAgent(userId, sharedAgentId);
};

/**
 * Set featured status for a shared agent
 * @param env The environment
 * @param sharedAgentId The shared agent ID
 * @param featured Whether the agent should be featured
 */
export const setFeaturedStatus = async (
  env: IEnv,
  sharedAgentId: string,
  featured: boolean,
): Promise<void> => {
  const repo = new SharedAgentRepository(env);
  return repo.setFeatured(sharedAgentId, featured);
};

/**
 * Moderate a shared agent (approve/reject)
 * @param env The environment
 * @param sharedAgentId The shared agent ID
 * @param isPublic Whether the agent should be public
 */
export const moderateSharedAgent = async (
  env: IEnv,
  sharedAgentId: string,
  isPublic: boolean,
): Promise<void> => {
  const repo = new SharedAgentRepository(env);
  return repo.moderateAgent(sharedAgentId, isPublic);
};

/**
 * Get available categories
 * @param env The environment
 * @returns Array of category names
 */
export const getSharedAgentCategories = async (
  env: IEnv,
): Promise<string[]> => {
  const repo = new SharedAgentRepository(env);
  return repo.getCategories();
};

/**
 * Get popular tags
 * @param env The environment
 * @param limit The number of tags to return
 * @returns Array of popular tag names
 */
export const getSharedAgentPopularTags = async (
  env: IEnv,
  limit = 20,
): Promise<string[]> => {
  const repo = new SharedAgentRepository(env);
  return repo.getPopularTags(limit);
};

/**
 * Share an agent
 * @param env The environment
 * @param userId The user ID
 * @param params The parameters for sharing
 * @returns The shared agent
 */
export const shareAgent = async (
  env: IEnv,
  userId: number,
  params: CreateSharedAgentParams,
): Promise<SharedAgent> => {
  const repo = new SharedAgentRepository(env);
  return repo.shareAgent(userId, params);
};
