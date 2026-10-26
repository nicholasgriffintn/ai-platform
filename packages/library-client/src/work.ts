import type {
  AnswerStandupInput,
  CreateInitiativeInput,
  Initiative,
  InitiativeListResponse,
  OnboardingState,
  ProjectTask,
  ProjectTaskLink,
  ProjectTaskLinkKind,
  ProjectTaskThreadPost,
  ProjectTaskThreadResponse,
  ProposeHireInput,
  RaiseCaseInput,
  SetupPlan,
  SetupPlanState,
  StandupSettings,
  StartOnboardingInput,
  UpdateInitiativeInput,
  UpdateWorkspaceTeammateInput,
  WorkActor,
  WorkCostsResponse,
  WorkInboxResponse,
  WorkRailsResponse,
  WorkspaceTeamDirectoryResponse,
  WorkspaceTeammate,
  WorkspaceTeamResponse,
  WorkTaskListResponse,
} from "@ngriffin_uk/polychat-schemas";

import { requestJson, withQuery } from "./resource.js";

function taskPath(projectId: string, taskId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`;
}

function workspacePath(workspaceId: string): string {
  return `/workspaces/${encodeURIComponent(workspaceId)}`;
}

type TaskResult = Promise<{ task: ProjectTask }>;

export function commentOnTask(
  projectId: string,
  taskId: string,
  body: string,
): Promise<{ post: ProjectTaskThreadPost }> {
  return requestJson(`${taskPath(projectId, taskId)}/comment`, "POST", { body });
}

export function assignTask(projectId: string, taskId: string, owner: WorkActor): TaskResult {
  return requestJson(`${taskPath(projectId, taskId)}/assign`, "POST", { owner });
}

export function requestTaskReview(
  projectId: string,
  taskId: string,
  reviewer: WorkActor,
  note: string | null,
): TaskResult {
  return requestJson(`${taskPath(projectId, taskId)}/request_review`, "POST", { reviewer, note });
}

export function reviewTask(
  projectId: string,
  taskId: string,
  decision: "accept" | "changes",
  note: string,
): TaskResult {
  return requestJson(`${taskPath(projectId, taskId)}/review`, "POST", { decision, note });
}

export function blockTask(
  projectId: string,
  taskId: string,
  reason: string,
  unblocker: WorkActor,
): TaskResult {
  return requestJson(`${taskPath(projectId, taskId)}/block`, "POST", { reason, unblocker });
}

export function escalateTask(projectId: string, taskId: string, reason: string): TaskResult {
  return requestJson(`${taskPath(projectId, taskId)}/escalate`, "POST", { reason });
}

export function sendTaskAgain(projectId: string, taskId: string): TaskResult {
  return requestJson(`${taskPath(projectId, taskId)}/send_again`, "POST");
}

export function clearTaskEscalation(projectId: string, taskId: string): TaskResult {
  return requestJson(`${taskPath(projectId, taskId)}/clear_escalation`, "POST");
}

export function resolveCase(projectId: string, taskId: string, resolution: string): TaskResult {
  return requestJson(`${taskPath(projectId, taskId)}/resolve`, "POST", { resolution });
}

export function sendCaseReply(projectId: string, taskId: string, body: string): TaskResult {
  return requestJson(`${taskPath(projectId, taskId)}/send_reply`, "POST", { body });
}

export function raiseCase(projectId: string, input: RaiseCaseInput): TaskResult {
  return requestJson(`/projects/${encodeURIComponent(projectId)}/cases`, "POST", input);
}

export function linkTasks(
  projectId: string,
  taskId: string,
  toTaskId: string,
  kind: ProjectTaskLinkKind,
): Promise<{ link: ProjectTaskLink }> {
  return requestJson(`${taskPath(projectId, taskId)}/links`, "POST", { toTaskId, kind });
}

export function unlinkTasks(projectId: string, taskId: string, linkId: string): Promise<unknown> {
  return requestJson(
    `${taskPath(projectId, taskId)}/links/${encodeURIComponent(linkId)}`,
    "DELETE",
  );
}

export function answerStandup(
  projectId: string,
  taskId: string,
  input: AnswerStandupInput,
): TaskResult {
  return requestJson(`${taskPath(projectId, taskId)}/answer_standup`, "POST", input);
}

export function getStandupDraft(projectId: string, taskId: string): Promise<AnswerStandupInput> {
  return requestJson(`${taskPath(projectId, taskId)}/standup_draft`, "GET");
}

export function getStandupSettings(projectId: string): Promise<StandupSettings> {
  return requestJson(`/projects/${encodeURIComponent(projectId)}/standup`, "GET");
}

export function setStandupSettings(
  projectId: string,
  settings: StandupSettings,
): Promise<StandupSettings> {
  return requestJson(`/projects/${encodeURIComponent(projectId)}/standup`, "PATCH", settings);
}

export function getProjectTaskThread(
  projectId: string,
  taskId: string,
): Promise<ProjectTaskThreadResponse> {
  return requestJson(`${taskPath(projectId, taskId)}/thread`, "GET");
}

export function getWorkspaceTeamDirectory(
  workspaceId: string,
): Promise<WorkspaceTeamDirectoryResponse> {
  return requestJson(`${workspacePath(workspaceId)}/team_directory`, "GET");
}

export function getWorkspaceTeam(workspaceId: string): Promise<WorkspaceTeamResponse> {
  return requestJson(`${workspacePath(workspaceId)}/team`, "GET");
}

export function updateWorkspaceTeammate(
  workspaceId: string,
  teammateId: string,
  input: UpdateWorkspaceTeammateInput,
): Promise<WorkspaceTeammate> {
  return requestJson(
    `${workspacePath(workspaceId)}/team/${encodeURIComponent(teammateId)}`,
    "PATCH",
    input,
  );
}

export function decideHire(
  workspaceId: string,
  teammateId: string,
  decision: "approve" | "reject",
): Promise<WorkspaceTeamResponse> {
  return requestJson(
    `${workspacePath(workspaceId)}/team/${encodeURIComponent(teammateId)}/decision`,
    "POST",
    { decision },
  );
}

export function proposeHire(
  workspaceId: string,
  input: ProposeHireInput,
): Promise<WorkspaceTeammate> {
  return requestJson(`${workspacePath(workspaceId)}/hires`, "POST", input);
}

export function listInitiatives(workspaceId: string): Promise<InitiativeListResponse> {
  return requestJson(`${workspacePath(workspaceId)}/initiatives`, "GET");
}

export function createInitiative(
  workspaceId: string,
  input: CreateInitiativeInput,
): Promise<Initiative> {
  return requestJson(`${workspacePath(workspaceId)}/initiatives`, "POST", input);
}

export function updateInitiative(
  workspaceId: string,
  initiativeId: string,
  input: UpdateInitiativeInput,
): Promise<Initiative> {
  return requestJson(
    `${workspacePath(workspaceId)}/initiatives/${encodeURIComponent(initiativeId)}`,
    "PATCH",
    input,
  );
}

export function deleteInitiative(workspaceId: string, initiativeId: string): Promise<unknown> {
  return requestJson(
    `${workspacePath(workspaceId)}/initiatives/${encodeURIComponent(initiativeId)}`,
    "DELETE",
  );
}

export function listWorkspaceTasks(
  workspaceId: string,
  query: { owner_teammate_id?: string; include_done?: boolean } = {},
): Promise<WorkTaskListResponse> {
  return requestJson(withQuery(`${workspacePath(workspaceId)}/tasks`, query), "GET");
}

export function listMyTasks(query: { include_done?: boolean } = {}): Promise<WorkTaskListResponse> {
  return requestJson(withQuery("/attention/tasks", query), "GET");
}

export function getWorkInbox(): Promise<WorkInboxResponse> {
  return requestJson("/attention/inbox", "GET");
}

export function getWorkCosts(workspaceId: string, period?: string): Promise<WorkCostsResponse> {
  return requestJson(withQuery(`${workspacePath(workspaceId)}/costs`, { period }), "GET");
}

export function getWorkRails(workspaceId: string, hours = 24): Promise<WorkRailsResponse> {
  return requestJson(withQuery(`${workspacePath(workspaceId)}/rails`, { hours }), "GET");
}

export function startOnboarding(input: StartOnboardingInput): Promise<OnboardingState> {
  return requestJson("/workspaces/onboarding/start", "POST", input);
}

export function getWorkspaceSetup(workspaceId: string): Promise<OnboardingState> {
  return requestJson(`${workspacePath(workspaceId)}/setup`, "GET");
}

export function startWorkspaceSetup(workspaceId: string): Promise<OnboardingState> {
  return requestJson(`${workspacePath(workspaceId)}/setup`, "POST");
}

export function reviseSetupPlan(
  workspaceId: string,
  plan: SetupPlan,
  expectedRevision: number | null,
): Promise<SetupPlanState> {
  return requestJson(`${workspacePath(workspaceId)}/setup`, "PATCH", { plan, expectedRevision });
}

export function approveSetupPlan(workspaceId: string, revision: number): Promise<SetupPlanState> {
  return requestJson(`${workspacePath(workspaceId)}/setup/approve`, "POST", { revision });
}

export function archiveSetup(workspaceId: string): Promise<unknown> {
  return requestJson(`${workspacePath(workspaceId)}/setup/archive`, "POST");
}
