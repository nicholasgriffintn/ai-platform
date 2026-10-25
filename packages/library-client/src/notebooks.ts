import type {
  CreateNotebookInput,
  CreateNotebookNoteInput,
  LinkNotebookSourcesInput,
  Notebook,
  NotebookDetail,
  NotebookResearchInput,
  NotebookResearchResponse,
  NotebookStudioRequestInput,
  NotebookStudioResponse,
  SourceSummary,
  StudyProgress,
  UpdateNotebookInput,
} from "@ngriffin_uk/polychat-schemas";

import { requestBlob, requestJson, resource } from "./resource.js";

const notebooks = resource<Notebook, CreateNotebookInput, UpdateNotebookInput>("/notebooks");

function notebookPath(notebookId: string, suffix = ""): string {
  return `/notebooks/${encodeURIComponent(notebookId)}${suffix}`;
}

export function listNotebooks(projectId?: string): Promise<Notebook[]> {
  return notebooks.listAll({ project_id: projectId });
}

export function getNotebook(notebookId: string): Promise<NotebookDetail> {
  return requestJson(notebookPath(notebookId), "GET");
}

export function createNotebook(input: CreateNotebookInput): Promise<Notebook> {
  return notebooks.create(input);
}

export function updateNotebook(notebookId: string, input: UpdateNotebookInput): Promise<Notebook> {
  return notebooks.update(notebookId, input);
}

export function deleteNotebook(notebookId: string): Promise<void> {
  return notebooks.delete(notebookId);
}

export function addNotebookSources(
  notebookId: string,
  input: LinkNotebookSourcesInput,
): Promise<NotebookDetail> {
  return requestJson(notebookPath(notebookId, "/sources"), "POST", input, { timeoutMs: null });
}

export function removeNotebookSource(
  notebookId: string,
  sourceId: string,
): Promise<NotebookDetail> {
  return requestJson(
    notebookPath(notebookId, `/sources/${encodeURIComponent(sourceId)}`),
    "DELETE",
  );
}

export function createNotebookNote(
  notebookId: string,
  input: CreateNotebookNoteInput,
): Promise<SourceSummary> {
  return requestJson(notebookPath(notebookId, "/notes"), "POST", input);
}

export function promoteNotebookNote(notebookId: string, noteId: string): Promise<NotebookDetail> {
  return requestJson(
    notebookPath(notebookId, `/notes/${encodeURIComponent(noteId)}/promote`),
    "POST",
    {},
  );
}

export function researchForNotebook(
  notebookId: string,
  input: NotebookResearchInput,
): Promise<NotebookResearchResponse> {
  return requestJson(notebookPath(notebookId, "/research"), "POST", input, { timeoutMs: null });
}

export function startNotebookStudio(
  notebookId: string,
  input: NotebookStudioRequestInput,
): Promise<NotebookStudioResponse> {
  return requestJson(notebookPath(notebookId, "/studio"), "POST", input, { timeoutMs: null });
}

function progressPath(notebookId: string, outputId: string): string {
  return notebookPath(notebookId, `/outputs/${encodeURIComponent(outputId)}/progress`);
}

export function getStudyProgress(notebookId: string, outputId: string): Promise<StudyProgress> {
  return requestJson(progressPath(notebookId, outputId), "GET");
}

export function saveStudyProgress(
  notebookId: string,
  outputId: string,
  progress: StudyProgress,
): Promise<StudyProgress> {
  return requestJson(progressPath(notebookId, outputId), "PATCH", progress);
}

export function getNotebookSceneImage(
  notebookId: string,
  outputId: string,
  index: number,
): Promise<Blob> {
  return requestBlob(
    notebookPath(notebookId, `/outputs/${encodeURIComponent(outputId)}/scenes/${index}`),
  );
}
