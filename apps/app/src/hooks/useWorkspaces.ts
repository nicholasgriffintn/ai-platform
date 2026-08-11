import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type {
	AddProjectCapabilityInput,
	CreateProjectInput,
	CreateWorkspaceInput,
	CreateWorkspaceInvitationInput,
	ProjectDetail,
	ProjectSummary,
	UpdateProjectInput,
	UpdateWorkspaceInput,
	WorkspaceDetail,
	WorkspaceSummary,
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

const WORK_QUERY_STALE_TIME = 2 * 60 * 1000;
const WORK_QUERY_GC_TIME = 30 * 60 * 1000;

type WorkspaceListData = { workspaces: WorkspaceSummary[] };

function projectSummaryFromDetail(project: ProjectDetail): ProjectSummary {
	return {
		id: project.id,
		workspaceId: project.workspaceId,
		name: project.name,
		description: project.description,
		instructions: project.instructions,
		colour: project.colour,
		createdBy: project.createdBy,
		createdAt: project.createdAt,
		updatedAt: project.updatedAt,
		conversationCount: project.conversationCount,
		capabilityCount: project.capabilityCount,
		codingEnvironment: project.codingEnvironment,
	};
}

function workspaceSummaryFromDetail(workspace: WorkspaceDetail): WorkspaceSummary {
	return {
		id: workspace.id,
		name: workspace.name,
		description: workspace.description,
		colour: workspace.colour,
		role: workspace.role,
		memberCount: workspace.memberCount,
		projectCount: workspace.projectCount,
		createdAt: workspace.createdAt,
		updatedAt: workspace.updatedAt,
	};
}

function updateProjectInWorkspaceCaches(queryClient: QueryClient, project: ProjectDetail) {
	const summary = projectSummaryFromDetail(project);
	queryClient.setQueryData<WorkspaceDetail>(workspaceQueryKey(project.workspaceId), (workspace) => {
		if (!workspace) return workspace;
		return {
			...workspace,
			projects: workspace.projects.map((item) => (item.id === project.id ? summary : item)),
		};
	});
}

function addProjectToWorkspaceCaches(queryClient: QueryClient, project: ProjectDetail) {
	const summary = projectSummaryFromDetail(project);
	queryClient.setQueryData<WorkspaceDetail>(workspaceQueryKey(project.workspaceId), (workspace) => {
		if (!workspace || workspace.projects.some((item) => item.id === project.id)) return workspace;
		return {
			...workspace,
			projectCount: workspace.projectCount + 1,
			projects: [...workspace.projects, summary],
		};
	});
	queryClient.setQueryData<WorkspaceListData>(WORKSPACES_QUERY_KEY, (data) => {
		if (!data) return data;
		return {
			workspaces: data.workspaces.map((workspace) =>
				workspace.id === project.workspaceId
					? { ...workspace, projectCount: workspace.projectCount + 1 }
					: workspace,
			),
		};
	});
}

function addWorkspaceToListCache(queryClient: QueryClient, workspace: WorkspaceDetail) {
	queryClient.setQueryData<WorkspaceListData>(WORKSPACES_QUERY_KEY, (data) => {
		if (!data || data.workspaces.some((item) => item.id === workspace.id)) return data;
		return { workspaces: [workspaceSummaryFromDetail(workspace), ...data.workspaces] };
	});
}

function upsertWorkspaceInListCache(queryClient: QueryClient, workspace: WorkspaceDetail) {
	queryClient.setQueryData<WorkspaceListData>(WORKSPACES_QUERY_KEY, (data) => {
		if (!data) return data;
		const summary = workspaceSummaryFromDetail(workspace);
		if (!data.workspaces.some((item) => item.id === workspace.id)) {
			return { workspaces: [summary, ...data.workspaces] };
		}
		return {
			workspaces: data.workspaces.map((item) => (item.id === workspace.id ? summary : item)),
		};
	});
}

export function useWorkspaces() {
	const isAuthenticated = useChatStore((state) => state.isAuthenticated);
	return useQuery({
		queryKey: WORKSPACES_QUERY_KEY,
		queryFn: listWorkspaces,
		enabled: isAuthenticated,
		staleTime: WORK_QUERY_STALE_TIME,
		gcTime: WORK_QUERY_GC_TIME,
	});
}

export function useWorkspace(workspaceId?: string) {
	const isAuthenticated = useChatStore((state) => state.isAuthenticated);
	return useQuery({
		queryKey: workspaceQueryKey(workspaceId ?? ""),
		queryFn: () => getWorkspace(workspaceId!),
		enabled: Boolean(workspaceId) && isAuthenticated,
		staleTime: WORK_QUERY_STALE_TIME,
		gcTime: WORK_QUERY_GC_TIME,
	});
}

export function useProject(projectId?: string) {
	const isAuthenticated = useChatStore((state) => state.isAuthenticated);
	return useQuery({
		queryKey: projectQueryKey(projectId ?? ""),
		queryFn: () => getProject(projectId!),
		enabled: Boolean(projectId) && isAuthenticated,
		staleTime: WORK_QUERY_STALE_TIME,
		gcTime: WORK_QUERY_GC_TIME,
	});
}

export function useCreateWorkspace() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateWorkspaceInput) => createWorkspace(input),
		onSuccess: (workspace) => {
			queryClient.setQueryData(workspaceQueryKey(workspace.id), workspace);
			addWorkspaceToListCache(queryClient, workspace);
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
			upsertWorkspaceInListCache(queryClient, workspace);
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
			addProjectToWorkspaceCaches(queryClient, project);
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
			updateProjectInWorkspaceCaches(queryClient, project);
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
			upsertWorkspaceInListCache(queryClient, workspace);
		},
	});
}

export function useAddProjectCapability() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ projectId, input }: { projectId: string; input: AddProjectCapabilityInput }) =>
			addProjectCapability(projectId, input),
		onSuccess: (project) => {
			queryClient.setQueryData(projectQueryKey(project.id), project);
			updateProjectInWorkspaceCaches(queryClient, project);
		},
	});
}

export function useRemoveProjectCapability() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ projectId, capabilityId }: { projectId: string; capabilityId: string }) =>
			removeProjectCapability(projectId, capabilityId),
		onSuccess: (project) => {
			queryClient.setQueryData(projectQueryKey(project.id), project);
			updateProjectInWorkspaceCaches(queryClient, project);
		},
	});
}
