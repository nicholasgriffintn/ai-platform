import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Agent } from "~/lib/database/schema";
import type {
  SharedTeammateWithAuthor,
  SharedAgent,
  SharedTeammateFilters,
  CreateSharedTeammateParams,
  TeammateInstall,
  TeammateRating,
} from "~/repositories/SharedTeammateRepository";

const ensureDb = (context: ServiceContext) => {
  context.ensureDatabase();

  return context.repositories.sharedAgents;
};

export const getSharedTeammates = async (
  context: ServiceContext,
  filters: SharedTeammateFilters = {},
): Promise<SharedTeammateWithAuthor[]> => {
  return ensureDb(context).getSharedTeammates(filters);
};

export const getFeaturedTeammates = async (
  context: ServiceContext,
  limit = 10,
): Promise<SharedTeammateWithAuthor[]> => {
  return ensureDb(context).getFeaturedTeammates(limit);
};

export const getSharedTeammateById = async (
  context: ServiceContext,
  id: string,
): Promise<SharedTeammateWithAuthor | null> => {
  return ensureDb(context).getSharedTeammateById(id);
};

export const getSharedTeammateByTeammateId = async (
  context: ServiceContext,
  teammateId: string,
): Promise<SharedAgent | null> => {
  return ensureDb(context).getSharedTeammateByTeammateId(teammateId);
};

export const getAllSharedTeammatesForAdmin = async (
  context: ServiceContext,
  filters: SharedTeammateFilters = {},
): Promise<SharedTeammateWithAuthor[]> => {
  return ensureDb(context).getAllSharedTeammatesForAdmin(filters);
};

export const installSharedTeammate = async (
  context: ServiceContext,
  sharedTeammateId: string,
  userId?: number,
): Promise<{ agent: Agent; install: TeammateInstall }> => {
  const repo = ensureDb(context);
  const id = userId ?? context.requireUser().id;

  return repo.installTeammate(id, sharedTeammateId);
};

export const uninstallSharedTeammate = async (
  context: ServiceContext,
  teammateId: string,
  userId?: number,
): Promise<void> => {
  const repo = ensureDb(context);
  const id = userId ?? context.requireUser().id;

  await repo.uninstallTeammate(id, teammateId);
};

export const rateSharedTeammate = async (
  context: ServiceContext,
  sharedTeammateId: string,
  rating: number,
  review?: string,
  userId?: number,
): Promise<TeammateRating> => {
  const repo = ensureDb(context);
  const id = userId ?? context.requireUser().id;

  return repo.rateTeammate(id, sharedTeammateId, rating, review);
};

export const getSharedTeammateRatings = async (
  context: ServiceContext,
  sharedTeammateId: string,
  limit = 10,
): Promise<(TeammateRating & { author_name: string })[]> => {
  return ensureDb(context).getTeammateRatings(sharedTeammateId, limit);
};

export const updateSharedTeammate = async (
  context: ServiceContext,
  sharedTeammateId: string,
  updates: Partial<Pick<SharedAgent, "name" | "description" | "avatar_url" | "category" | "tags">>,
  userId?: number,
): Promise<void> => {
  const repo = ensureDb(context);
  const id = userId ?? context.requireUser().id;

  await repo.updateSharedTeammate(id, sharedTeammateId, updates);
};

export const deleteSharedTeammate = async (
  context: ServiceContext,
  sharedTeammateId: string,
  userId?: number,
): Promise<void> => {
  const repo = ensureDb(context);
  const id = userId ?? context.requireUser().id;

  await repo.deleteSharedTeammate(id, sharedTeammateId);
};

export const setFeaturedStatus = async (
  context: ServiceContext,
  sharedTeammateId: string,
  featured: boolean,
): Promise<void> => {
  await ensureDb(context).setFeatured(sharedTeammateId, featured);
};

export const moderateSharedTeammate = async (
  context: ServiceContext,
  sharedTeammateId: string,
  isPublic: boolean,
): Promise<void> => {
  await ensureDb(context).moderateTeammate(sharedTeammateId, isPublic);
};

export const getSharedTeammateCategories = async (context: ServiceContext): Promise<string[]> => {
  return ensureDb(context).getCategories();
};

export const getSharedTeammatePopularTags = async (
  context: ServiceContext,
  limit = 20,
): Promise<string[]> => {
  return ensureDb(context).getPopularTags(limit);
};

export const shareTeammate = async (
  context: ServiceContext,
  params: CreateSharedTeammateParams,
  userId?: number,
): Promise<SharedAgent> => {
  const repo = ensureDb(context);
  const id = userId ?? context.requireUser().id;

  return repo.shareTeammate(id, params);
};
