import { useMemo, useState } from "react";
import type {
	AssistantActionItem,
	ProjectCapability,
	ProjectCapabilityKind,
	ProjectToolDefinition,
} from "@assistant/schemas";

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
import { useRecipeActionRequest } from "~/components/Apps/Recipes/useRecipeActionRequest";
import { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";
import type { ProjectToolConfiguration } from "~/lib/project-tool-configuration";
import { useWorkData } from "./WorkContext";

export function useProjectLibraryController(workspaceId: string, projectId: string) {
	const { projectQuery, workspaceQuery } = useWorkData();
	const catalog = useProjectCapabilityCatalog();
	const addCapability = useAddProjectCapability();
	const removeCapability = useRemoveProjectCapability();
	const { data: installationsData } = useRecipeInstallations();
	const recipeWorkflows = useRecipeWorkflows({
		conversationPath: `/work/${workspaceId}/projects/${projectId}/chat`,
	});
	const [query, setQuery] = useState("");
	const [kind, setKind] = useState<ProjectCapabilityKindFilter>("all");
	const [category, setCategory] = useState("all");
	const [configurationTool, setConfigurationTool] = useState<ProjectToolDefinition | null>(null);
	const [configurationToolCapability, setConfigurationToolCapability] =
		useState<ProjectCapability>();

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
				(installationsData?.installations ?? []).map((installation) => [
					installation.recipeId,
					installation,
				]),
			),
		[installationsData?.installations],
	);

	useRecipeActionRequest(catalog.recipes, installationByRecipeId, recipeWorkflows.actions);

	const saveCapability = (
		item: AssistantActionItem,
		itemKind: ProjectCapabilityKind,
		configuration: Record<string, unknown> = {},
	) =>
		addCapability.mutateAsync({
			projectId,
			input: { kind: itemKind, capabilityId: item.capability.id, configuration },
		});

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
			isLoading: addCapability.isPending,
			open: (tool: ProjectToolDefinition, capability?: ProjectCapability) => {
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
		mutations: {
			add: addCapability,
			remove: removeCapability,
		},
		recipes: {
			installationByRecipeId,
			workflows: recipeWorkflows,
		},
		project: projectQuery.data,
		isLoadingProject: projectQuery.isLoading,
		canManage: workspaceQuery.data?.role === "owner" || workspaceQuery.data?.role === "admin",
		actions: {
			addItem,
			removeCapability: (capability: ProjectCapability) =>
				removeCapability.mutate({ projectId, capabilityId: capability.id }),
		},
	};
}
