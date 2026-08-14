import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateTemplateInput, WorkspaceRole } from "@ngriffin_uk/polychat-schemas";

import {
	createTemplate,
	deleteTemplate,
	instantiateTemplate,
	leaveWorkspace,
	listWorkspaceAudit,
	listWorkspaceTemplates,
	removeWorkspaceMember,
	transferWorkspaceOwnership,
	updateWorkspaceMember,
} from "~/lib/api/governance";
import { projectQueryKey, workspaceQueryKey, WORKSPACES_QUERY_KEY } from "./useWorkspaces";

export function useWorkspaceAudit(workspaceId: string, enabled = true) {
	return useQuery({
		queryKey: ["workspace-audit", workspaceId],
		queryFn: () => listWorkspaceAudit(workspaceId),
		enabled,
	});
}

export function useWorkspaceTemplates(workspaceId: string, enabled = true) {
	return useQuery({
		queryKey: ["workspace-templates", workspaceId],
		queryFn: () => listWorkspaceTemplates(workspaceId),
		enabled,
	});
}

export function useTemplateMutations(workspaceId: string) {
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["workspace-templates", workspaceId] });
	return {
		create: useMutation({
			mutationFn: (input: CreateTemplateInput) => createTemplate(input),
			onSuccess: invalidate,
		}),
		remove: useMutation({ mutationFn: deleteTemplate, onSuccess: invalidate }),
		instantiate: useMutation({
			mutationFn: (templateId: string) => instantiateTemplate(templateId, workspaceId),
			onSuccess: (project) => {
				queryClient.setQueriesData({ queryKey: projectQueryKey(project.id) }, project);
				queryClient.invalidateQueries({ queryKey: workspaceQueryKey(workspaceId) });
			},
		}),
	};
}

export function useWorkspaceMemberMutations(workspaceId: string) {
	const queryClient = useQueryClient();
	const updateCache = (workspace: unknown) =>
		queryClient.setQueryData(workspaceQueryKey(workspaceId), workspace);
	return {
		updateRole: useMutation({
			mutationFn: ({ userId, role }: { userId: number; role: Exclude<WorkspaceRole, "owner"> }) =>
				updateWorkspaceMember(workspaceId, userId, role),
			onSuccess: updateCache,
		}),
		remove: useMutation({
			mutationFn: (userId: number) => removeWorkspaceMember(workspaceId, userId),
			onSuccess: updateCache,
		}),
		transfer: useMutation({
			mutationFn: (userId: number) => transferWorkspaceOwnership(workspaceId, userId),
			onSuccess: updateCache,
		}),
		leave: useMutation({
			mutationFn: () => leaveWorkspace(workspaceId),
			onSuccess: () => {
				queryClient.removeQueries({ queryKey: workspaceQueryKey(workspaceId) });
				queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
			},
		}),
	};
}
