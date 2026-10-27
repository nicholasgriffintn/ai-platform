import {
  answerStandup,
  approveSetupPlan,
  archiveSetup,
  assignTask,
  blockTask,
  clearTaskEscalation,
  commentOnTask,
  createInitiative,
  decideHire,
  deleteInitiative,
  escalateTask,
  getProjectTaskThread,
  getStandupDraft,
  getStandupSettings,
  getWorkCosts,
  getWorkInbox,
  getWorkRails,
  getWorkspaceSetup,
  getWorkspaceTeam,
  getWorkspaceTeamDirectory,
  linkTasks,
  listInitiatives,
  listMyTasks,
  listWorkspaceTasks,
  proposeHire,
  raiseCase,
  requestTaskReview,
  resolveCase,
  reviewTask,
  reviseSetupPlan,
  sendCaseReply,
  sendTaskAgain,
  acceptTaskBreakdown,
  setStandupSettings,
  saveTeamTemplate,
  startOnboarding,
  startWorkspaceSetup,
  unlinkTasks,
  updateInitiative,
  updateWorkspace,
  updateWorkspaceTeammate,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import type {
  AnswerStandupInput,
  CreateInitiativeInput,
  ProjectTaskLinkKind,
  ProposeHireInput,
  RaiseCaseInput,
  SetupPlan,
  StandupSettings,
  SaveTeamTemplateInput,
  StartOnboardingInput,
  UpdateInitiativeInput,
  UpdateWorkspaceInput,
  UpdateWorkspaceTeammateInput,
  WorkActor,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { useLiveOrPoll } from "../sync/live-or-poll.js";
import {
  projectTaskDetailQueryKey,
  projectTasksQueryKey,
  TASK_ATTENTION_QUERY_KEY,
} from "./useProjectTasks.js";
import { WORKSPACES_QUERY_KEY, workspaceQueryKey } from "./useWorkspaces.js";

const WORK_QUERY_ROOT = "work" as const;
const WORK_REFETCH_MS = 30_000;

export const workInboxQueryKey = [WORK_QUERY_ROOT, "inbox"] as const;
export const myTasksQueryKey = [WORK_QUERY_ROOT, "my-tasks"] as const;
export const workspaceTeamQueryKey = (workspaceId: string) =>
  [WORK_QUERY_ROOT, "team", workspaceId] as const;
export const WORKSPACE_TASKS_QUERY_PREFIX = [WORK_QUERY_ROOT, "tasks"] as const;
export const workspaceTasksQueryKey = (workspaceId: string, teammateId?: string) =>
  [...WORKSPACE_TASKS_QUERY_PREFIX, workspaceId, teammateId ?? "all"] as const;
export const initiativesQueryKey = (workspaceId: string) =>
  [WORK_QUERY_ROOT, "initiatives", workspaceId] as const;
export const workCostsQueryKey = (workspaceId: string, period?: string) =>
  period
    ? ([WORK_QUERY_ROOT, "costs", workspaceId, period] as const)
    : ([WORK_QUERY_ROOT, "costs", workspaceId] as const);
export const workRailsQueryKey = (workspaceId: string, hours: number) =>
  [WORK_QUERY_ROOT, "rails", workspaceId, hours] as const;
export const workspaceSetupQueryKey = (workspaceId: string) =>
  [WORK_QUERY_ROOT, "setup", workspaceId] as const;
export const standupSettingsQueryKey = (projectId: string) =>
  [WORK_QUERY_ROOT, "standup", projectId] as const;

function useWorkEnabled(): boolean {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);

  return isAuthenticated && isPro;
}

function invalidateAllWork(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: [WORK_QUERY_ROOT] });
  void queryClient.invalidateQueries({ queryKey: TASK_ATTENTION_QUERY_KEY });
}

function invalidateTaskWork(queryClient: QueryClient, projectId: string, taskId?: string) {
  for (const queryKey of [
    workInboxQueryKey,
    myTasksQueryKey,
    WORKSPACE_TASKS_QUERY_PREFIX,
    [WORK_QUERY_ROOT, "initiatives"],
    TASK_ATTENTION_QUERY_KEY,
    projectTasksQueryKey(projectId),
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }

  if (taskId) {
    void queryClient.invalidateQueries({ queryKey: projectTaskDetailQueryKey(projectId, taskId) });
  }
}

function invalidateTeamWork(queryClient: QueryClient, workspaceId: string) {
  for (const queryKey of [
    workInboxQueryKey,
    workspaceTeamQueryKey(workspaceId),
    [WORK_QUERY_ROOT, "rails", workspaceId],
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

export function useWorkInbox() {
  const enabled = useChatStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: workInboxQueryKey,
    queryFn: getWorkInbox,
    enabled,
    refetchInterval: WORK_REFETCH_MS,
  });
}

export function useMyTasks(includeDone = false) {
  const enabled = useWorkEnabled();
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: [...myTasksQueryKey, includeDone],
    queryFn: () => listMyTasks({ include_done: includeDone }),
    enabled,
    refetchInterval: (query) => liveOrPoll(query, WORK_REFETCH_MS, "project_task.changed"),
  });
}

export function useWorkspaceTeam(workspaceId: string) {
  const enabled = useWorkEnabled();

  return useQuery({
    queryKey: workspaceTeamQueryKey(workspaceId),
    queryFn: () => getWorkspaceTeam(workspaceId),
    enabled: enabled && Boolean(workspaceId),
    refetchInterval: WORK_REFETCH_MS,
  });
}

export function useTaskThread(projectId: string, taskId: string) {
  const enabled = useWorkEnabled();
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: [...projectTaskDetailQueryKey(projectId, taskId), "thread"],
    queryFn: () => getProjectTaskThread(projectId, taskId),
    enabled: enabled && Boolean(projectId && taskId),
    refetchInterval: (query) => liveOrPoll(query, WORK_REFETCH_MS / 3, "project_task.changed"),
  });
}

export function useWorkspaceTeamDirectory(workspaceId: string) {
  const enabled = useWorkEnabled();

  return useQuery({
    queryKey: [...workspaceTeamQueryKey(workspaceId), "directory"],
    queryFn: () => getWorkspaceTeamDirectory(workspaceId),
    enabled: enabled && Boolean(workspaceId),
    staleTime: WORK_REFETCH_MS * 2,
  });
}

export function useWorkspaceTasks(workspaceId: string, teammateId?: string) {
  const enabled = useWorkEnabled();
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: workspaceTasksQueryKey(workspaceId, teammateId),
    queryFn: () =>
      listWorkspaceTasks(workspaceId, teammateId ? { owner_teammate_id: teammateId } : {}),
    enabled: enabled && Boolean(workspaceId),
    refetchInterval: (query) => liveOrPoll(query, WORK_REFETCH_MS, "project_task.changed"),
  });
}

export function useInitiatives(workspaceId: string) {
  const enabled = useWorkEnabled();

  return useQuery({
    queryKey: initiativesQueryKey(workspaceId),
    queryFn: () => listInitiatives(workspaceId),
    enabled: enabled && Boolean(workspaceId),
  });
}

export function useWorkCosts(workspaceId: string, period?: string) {
  const enabled = useWorkEnabled();

  return useQuery({
    queryKey: workCostsQueryKey(workspaceId, period),
    queryFn: () => getWorkCosts(workspaceId, period),
    enabled: enabled && Boolean(workspaceId),
  });
}

export function useWorkRails(workspaceId: string, hours = 24) {
  const enabled = useWorkEnabled();

  return useQuery({
    queryKey: workRailsQueryKey(workspaceId, hours),
    queryFn: () => getWorkRails(workspaceId, hours),
    enabled: enabled && Boolean(workspaceId),
    refetchInterval: WORK_REFETCH_MS,
  });
}

export function useWorkspaceSetup(workspaceId: string, enabledByCaller = true) {
  const enabled = useWorkEnabled();

  return useQuery({
    queryKey: workspaceSetupQueryKey(workspaceId),
    queryFn: () => getWorkspaceSetup(workspaceId),
    enabled: enabled && enabledByCaller && Boolean(workspaceId),
    retry: false,
    refetchInterval: (query) => (query.state.data?.setup?.appliedAt ? false : WORK_REFETCH_MS / 3),
  });
}

export function useStandupSettings(projectId: string) {
  const enabled = useWorkEnabled();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: standupSettingsQueryKey(projectId),
    queryFn: () => getStandupSettings(projectId),
    enabled: enabled && Boolean(projectId),
  });
  const save = useMutation({
    mutationFn: (settings: StandupSettings) => setStandupSettings(projectId, settings),
    onSuccess: (settings) => queryClient.setQueryData(standupSettingsQueryKey(projectId), settings),
  });

  return { ...query, save };
}

export function useStandupDraft(projectId: string, taskId: string, enabledByCaller: boolean) {
  const enabled = useWorkEnabled();

  return useQuery({
    queryKey: [WORK_QUERY_ROOT, "standup-draft", projectId, taskId],
    queryFn: () => getStandupDraft(projectId, taskId),
    enabled: enabled && enabledByCaller && Boolean(projectId && taskId),
    staleTime: Infinity,
  });
}

export function useWorkTaskActions(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  const settle = () => invalidateTaskWork(queryClient, projectId, taskId);

  return {
    comment: useMutation({
      mutationFn: (body: string) => commentOnTask(projectId, taskId, body),
      onSuccess: settle,
    }),
    assign: useMutation({
      mutationFn: (owner: WorkActor) => assignTask(projectId, taskId, owner),
      onSuccess: settle,
    }),
    requestReview: useMutation({
      mutationFn: (input: { reviewer: WorkActor; note: string | null }) =>
        requestTaskReview(projectId, taskId, input.reviewer, input.note),
      onSuccess: settle,
    }),
    review: useMutation({
      mutationFn: (input: { decision: "accept" | "changes"; note: string }) =>
        reviewTask(projectId, taskId, input.decision, input.note),
      onSuccess: settle,
    }),
    block: useMutation({
      mutationFn: (input: { reason: string; unblocker: WorkActor }) =>
        blockTask(projectId, taskId, input.reason, input.unblocker),
      onSuccess: settle,
    }),
    escalate: useMutation({
      mutationFn: (reason: string) => escalateTask(projectId, taskId, reason),
      onSuccess: settle,
    }),
    clearEscalation: useMutation({
      mutationFn: () => clearTaskEscalation(projectId, taskId),
      onSuccess: settle,
    }),
    acceptBreakdown: useMutation({
      mutationFn: (revision: number) => acceptTaskBreakdown(projectId, taskId, revision),
      onSuccess: settle,
    }),
    sendAgain: useMutation({
      mutationFn: () => sendTaskAgain(projectId, taskId),
      onSuccess: settle,
    }),
    resolve: useMutation({
      mutationFn: (resolution: string) => resolveCase(projectId, taskId, resolution),
      onSuccess: settle,
    }),
    sendReply: useMutation({
      mutationFn: (body: string) => sendCaseReply(projectId, taskId, body),
      onSuccess: settle,
    }),
    answerStandup: useMutation({
      mutationFn: (input: AnswerStandupInput) => answerStandup(projectId, taskId, input),
      onSuccess: settle,
    }),
    link: useMutation({
      mutationFn: (input: { toTaskId: string; kind: ProjectTaskLinkKind }) =>
        linkTasks(projectId, taskId, input.toTaskId, input.kind),
      onSuccess: settle,
    }),
    unlink: useMutation({
      mutationFn: (linkId: string) => unlinkTasks(projectId, taskId, linkId),
      onSuccess: settle,
    }),
  };
}

export function useRaiseCase(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RaiseCaseInput) => raiseCase(projectId, input),
    onSuccess: () => invalidateTaskWork(queryClient, projectId),
  });
}

export function useTeamActions(workspaceId: string) {
  const queryClient = useQueryClient();
  const settle = () => invalidateTeamWork(queryClient, workspaceId);

  return {
    update: useMutation({
      mutationFn: (input: { teammateId: string; changes: UpdateWorkspaceTeammateInput }) =>
        updateWorkspaceTeammate(workspaceId, input.teammateId, input.changes),
      onSuccess: settle,
    }),
    decide: useMutation({
      mutationFn: (input: { teammateId: string; decision: "approve" | "reject" }) =>
        decideHire(workspaceId, input.teammateId, input.decision),
      onSuccess: settle,
    }),
    propose: useMutation({
      mutationFn: (input: ProposeHireInput) => proposeHire(workspaceId, input),
      onSuccess: settle,
    }),
  };
}

export function useInitiativeActions(workspaceId: string) {
  const queryClient = useQueryClient();
  const settle = () =>
    void queryClient.invalidateQueries({ queryKey: initiativesQueryKey(workspaceId) });

  return {
    create: useMutation({
      mutationFn: (input: CreateInitiativeInput) => createInitiative(workspaceId, input),
      onSuccess: settle,
    }),
    update: useMutation({
      mutationFn: (input: { initiativeId: string; changes: UpdateInitiativeInput }) =>
        updateInitiative(workspaceId, input.initiativeId, input.changes),
      onSuccess: settle,
    }),
    remove: useMutation({
      mutationFn: (initiativeId: string) => deleteInitiative(workspaceId, initiativeId),
      onSuccess: settle,
    }),
  };
}

export function useSetupActions(workspaceId: string) {
  const queryClient = useQueryClient();
  const settle = () => {
    invalidateAllWork(queryClient);
    void queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: workspaceQueryKey(workspaceId) });
  };

  return {
    start: useMutation({
      mutationFn: () => startWorkspaceSetup(workspaceId),
      onSuccess: settle,
    }),
    revise: useMutation({
      mutationFn: (input: { plan: SetupPlan; expectedRevision: number | null }) =>
        reviseSetupPlan(workspaceId, input.plan, input.expectedRevision),
      onSuccess: settle,
    }),
    approve: useMutation({
      mutationFn: (revision: number) => approveSetupPlan(workspaceId, revision),
      onSuccess: settle,
    }),
    archive: useMutation({
      mutationFn: () => archiveSetup(workspaceId),
      onSuccess: settle,
    }),
  };
}

export function useStartOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: StartOnboardingInput) => startOnboarding(input),
    onSuccess: () => {
      invalidateAllWork(queryClient);
      void queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
    },
  });
}

export function useSaveTeamTemplate(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveTeamTemplateInput) => saveTeamTemplate(workspaceId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["team-templates"] }),
  });
}

export function useUpdateWorkspaceOrganisation(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateWorkspaceInput) => updateWorkspace(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKey(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: initiativesQueryKey(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: workCostsQueryKey(workspaceId) });
    },
  });
}

export function useDecideInboxHire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      workspaceId: string;
      teammateId: string;
      decision: "approve" | "reject";
    }) => decideHire(input.workspaceId, input.teammateId, input.decision),
    onSuccess: (_result, input) => invalidateTeamWork(queryClient, input.workspaceId),
  });
}
