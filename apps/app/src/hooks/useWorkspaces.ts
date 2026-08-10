import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
	AddProjectCapabilityInput,
	CreateProjectInput,
	CreateWorkspaceInput,
	CreateWorkspaceInvitationInput,
	UpdateProjectInput,
	UpdateWorkspaceInput,
} from "@assistant/schemas";
import {
	acceptWorkspaceInvitation,
	addProjectCapability,
	createProject,
	createWorkspace,
	getProject,
	getWorkspace,
	inviteWorkspaceMember,
	listWorkspaces,
	removeProjectCapability,
	updateProject,
	updateWorkspace,
} from "~/lib/api/workspaces";
import { useChatStore } from "~/state/stores/chatStore";

export const WORKSPACES_QUERY_KEY = ["workspaces"] as const;
export const workspaceQueryKey = (workspaceId: string) => ["workspace", workspaceId] as const;
export const projectQueryKey = (projectId: string) => ["project", projectId] as const;

export function useWorkspaces() {
	const isAuthenticated = useChatStore((state) => state.isAuthenticated);
	return useQuery({
		queryKey: WORKSPACES_QUERY_KEY,
		queryFn: listWorkspaces,
		enabled: isAuthenticated,
	});
}

export function useWorkspace(workspaceId?: string) {
	return useQuery({
		queryKey: workspaceQueryKey(workspaceId ?? ""),
		queryFn: () => getWorkspace(workspaceId!),
		enabled: Boolean(workspaceId),
	});
}

export function useProject(projectId?: string) {
	return useQuery({
		queryKey: projectQueryKey(projectId ?? ""),
		queryFn: () => getProject(projectId!),
		enabled: Boolean(projectId),
	});
}

export function useCreateWorkspace() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateWorkspaceInput) => createWorkspace(input),
		onSuccess: (workspace) => {
			queryClient.setQueryData(workspaceQueryKey(workspace.id), workspace);
			queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
		},
	});
}

export function useUpdateWorkspace() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ workspaceId, input }: { workspaceId: string; input: UpdateWorkspaceInput }) =>
			updateWorkspace(workspaceId, input),
		onSuccess: (workspace) => {
			queryClient.setQueryData(workspaceQueryKey(workspace.id), workspace);
			queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
		},
	});
}

export function useCreateProject() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ workspaceId, input }: { workspaceId: string; input: CreateProjectInput }) =>
			createProject(workspaceId, input),
		onSuccess: (project) => {
			queryClient.setQueryData(projectQueryKey(project.id), project);
			queryClient.invalidateQueries({ queryKey: workspaceQueryKey(project.workspaceId) });
			queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
		},
	});
}

export function useUpdateProject() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ projectId, input }: { projectId: string; input: UpdateProjectInput }) =>
			updateProject(projectId, input),
		onSuccess: (project) => {
			queryClient.setQueryData(projectQueryKey(project.id), project);
			queryClient.invalidateQueries({ queryKey: workspaceQueryKey(project.workspaceId) });
		},
	});
}

export function useInviteWorkspaceMember() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			workspaceId,
			input,
		}: {
			workspaceId: string;
			input: CreateWorkspaceInvitationInput;
		}) => inviteWorkspaceMember(workspaceId, input),
		onSuccess: (_, variables) =>
			queryClient.invalidateQueries({ queryKey: workspaceQueryKey(variables.workspaceId) }),
	});
}

export function useAcceptWorkspaceInvitation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: acceptWorkspaceInvitation,
		onSuccess: (workspace) => {
			queryClient.setQueryData(workspaceQueryKey(workspace.id), workspace);
			queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
		},
	});
}

export function useAddProjectCapability() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ projectId, input }: { projectId: string; input: AddProjectCapabilityInput }) =>
			addProjectCapability(projectId, input),
		onSuccess: (project) => queryClient.setQueryData(projectQueryKey(project.id), project),
	});
}

export function useRemoveProjectCapability() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ projectId, capabilityId }: { projectId: string; capabilityId: string }) =>
			removeProjectCapability(projectId, capabilityId),
		onSuccess: (project) => queryClient.setQueryData(projectQueryKey(project.id), project),
	});
}
