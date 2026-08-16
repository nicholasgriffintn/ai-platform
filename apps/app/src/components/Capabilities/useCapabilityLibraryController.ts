import { useMemo, useState } from "react";
import type {
	AssistantActionItem,
	ProjectCapabilityKind,
	ProjectToolDefinition,
} from "@ngriffin_uk/polychat-schemas";

import { useProjectCapabilityCatalog } from "~/hooks/useProjectCapabilityCatalog";
import { useRecipeInstallations } from "~/hooks/useRecipes";
import { useAddProjectCapability, useRemoveProjectCapability } from "~/hooks/useWorkspaces";
import {
	filterProjectCapabilities,
	getProjectCapabilityCategories,
	getProjectCapabilityKind,
	groupProjectCapabilities,
	type ProjectCapabilityKindFilter,
} from "~/lib/project-capability-catalog";
import {
	type CapabilitySurface,
	type EnabledCapability,
	getProjectSurface,
	PERSONAL_SURFACE,
} from "~/lib/capability-surfaces";
import { useRecipeActionRequest } from "~/components/Apps/Recipes/useRecipeActionRequest";
import { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";
import { useChatStore } from "~/state/stores/chatStore";
import type { ProjectToolConfiguration } from "~/lib/project-tool-configuration";
import { areUserIdsEqual } from "@ngriffin_uk/polychat-utility-core";

export interface CapabilityLibraryScope {
	surface: CapabilitySurface;
	canManage: boolean;
	/**
	 * Projects curate what their members may use, so every capability is attached explicitly.
	 * A person already has everything: only recipes are opted into, because they carry
	 * credentials, schedules, and triggers of their own.
	 */
	requiresExplicitEnablement: boolean;
	capabilities: EnabledCapability[];
	conversationPath: string;
	error?: Error | null;
	isLoading: boolean;
	name?: string;
	add: (input: {
		kind: ProjectCapabilityKind;
		capabilityId: string;
		configuration: Record<string, unknown>;
	}) => Promise<unknown>;
	remove: (capability: EnabledCapability & { id: string }) => void;
	mutations: {
		add: { isPending: boolean; error: Error | null; variables?: { capabilityId?: string } };
		remove: { isPending: boolean; error: Error | null; variables?: { capabilityId?: string } };
	};
}

export function useCapabilityLibraryController(scope: CapabilityLibraryScope) {
	const catalog = useProjectCapabilityCatalog();
	const currentUserId = useChatStore((state) => state.user?.id);
	const { data: installationsData } = useRecipeInstallations(scope.surface.projectId);
	const recipeWorkflows = useRecipeWorkflows({
		conversationPath: scope.conversationPath,
		projectId: scope.surface.projectId,
	});
	const [query, setQuery] = useState("");
	const [kind, setKind] = useState<ProjectCapabilityKindFilter>("all");
	const [category, setCategory] = useState("all");
	const [configurationTool, setConfigurationTool] = useState<ProjectToolDefinition | null>(null);
	const [configurationToolCapability, setConfigurationToolCapability] =
		useState<EnabledCapability>();

	const items = useMemo(
		() => catalog.items.filter((item) => getProjectCapabilityKind(item) !== null),
		[catalog.items],
	);
	const categories = useMemo(() => getProjectCapabilityCategories(items, kind), [items, kind]);
	const visibleItems = useMemo(
		() => filterProjectCapabilities(items, { category, kind, query }),
		[category, items, kind, query],
	);
	const groups = useMemo(() => groupProjectCapabilities(visibleItems), [visibleItems]);
	const appById = useMemo(() => new Map(catalog.apps.map((app) => [app.id, app])), [catalog.apps]);
	const recipeById = useMemo(
		() => new Map(catalog.recipes.map((recipe) => [recipe.id, recipe])),
		[catalog.recipes],
	);
	const toolById = useMemo(
		() => new Map(catalog.tools.map((tool) => [tool.id, tool])),
		[catalog.tools],
	);
	const installationByRecipeId = useMemo(
		() =>
			new Map(
				(installationsData?.installations ?? [])
					.filter((installation) => areUserIdsEqual(installation.userId, currentUserId))
					.map((installation) => [installation.recipeId, installation]),
			),
		[currentUserId, installationsData?.installations],
	);

	useRecipeActionRequest(catalog.recipes, installationByRecipeId, recipeWorkflows.actions);

	const saveCapability = (
		item: AssistantActionItem,
		itemKind: ProjectCapabilityKind,
		configuration: Record<string, unknown> = {},
	) => scope.add({ kind: itemKind, capabilityId: item.capability.id, configuration });

	const addItem = (item: AssistantActionItem, itemKind: ProjectCapabilityKind) => {
		void saveCapability(item, itemKind).catch(() => undefined);
	};

	const submitToolConfiguration = async (configuration: ProjectToolConfiguration) => {
		if (!configurationTool) return;
		const item = items.find(
			(candidate) =>
				getProjectCapabilityKind(candidate) === "tool" &&
				candidate.capability.id === configurationTool.id,
		);
		if (!item) return;
		await saveCapability(item, "tool", configuration);
		setConfigurationTool(null);
		setConfigurationToolCapability(undefined);
	};

	return {
		catalog: {
			appById,
			error: catalog.error,
			experiences: catalog.experiences,
			groups,
			isLoading: catalog.isLoading,
			recipeById,
			toolById,
		},
		toolConfigurationDialog: {
			capability: configurationToolCapability,
			close: () => {
				setConfigurationTool(null);
				setConfigurationToolCapability(undefined);
			},
			isLoading: scope.mutations.add.isPending,
			open: (tool: ProjectToolDefinition, capability?: EnabledCapability) => {
				setConfigurationTool(tool);
				setConfigurationToolCapability(capability);
			},
			submit: submitToolConfiguration,
			tool: configurationTool,
		},
		filters: {
			categories,
			category,
			kind,
			query,
			setCategory,
			setKind: (nextKind: ProjectCapabilityKindFilter) => {
				setKind(nextKind);
				setCategory("all");
			},
			setQuery,
		},
		mutations: scope.mutations,
		surface: scope.surface,
		capabilities: scope.capabilities,
		scopeError: scope.error,
		scopeName: scope.name,
		isLoadingScope: scope.isLoading,
		recipes: {
			installationByRecipeId,
			workflows: recipeWorkflows,
		},
		currentUserId,
		canManage: scope.canManage,
		requiresExplicitEnablement: scope.requiresExplicitEnablement,
		actions: {
			addItem,
			removeCapability: (capability: EnabledCapability & { id: string }) =>
				scope.remove(capability),
		},
	};
}

export function usePersonalCapabilityScope(): CapabilityLibraryScope {
	return {
		surface: PERSONAL_SURFACE,
		canManage: true,
		requiresExplicitEnablement: false,
		capabilities: [],
		conversationPath: "/chat",
		isLoading: false,
		add: () => Promise.resolve(),
		remove: () => undefined,
		mutations: {
			add: { isPending: false, error: null },
			remove: { isPending: false, error: null },
		},
	};
}

export function useProjectCapabilityScope(
	workspaceId: string,
	projectId: string,
	project: { name?: string; capabilities?: EnabledCapability[] } | undefined,
	role: string | undefined,
	projectError: Error | null,
	isLoading: boolean,
): CapabilityLibraryScope {
	const add = useAddProjectCapability();
	const remove = useRemoveProjectCapability();

	return {
		surface: getProjectSurface(workspaceId, projectId),
		canManage: role === "owner" || role === "admin",
		requiresExplicitEnablement: true,
		capabilities: project?.capabilities ?? [],
		conversationPath: `/work/${workspaceId}/projects/${projectId}/chat`,
		error: projectError,
		isLoading,
		name: project?.name,
		add: (input) => add.mutateAsync({ projectId, input }),
		remove: (capability) => remove.mutate({ projectId, capabilityId: capability.id }),
		mutations: {
			add: {
				isPending: add.isPending,
				error: add.error as Error | null,
				variables: { capabilityId: add.variables?.input.capabilityId },
			},
			remove: {
				isPending: remove.isPending,
				error: remove.error as Error | null,
				variables: { capabilityId: remove.variables?.capabilityId },
			},
		},
	};
}
