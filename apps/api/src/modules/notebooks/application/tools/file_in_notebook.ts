import {
  fileInNotebookInputSchema,
  NOTEBOOK_FILE_TOOL_NAME,
  type FileInNotebookInput,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { findNotebookAccess } from "~/modules/notebooks/application/access";
import {
  createNotebook,
  createNotebookNote,
  linkNotebookSources,
} from "~/modules/notebooks/application/notebooks";
import { importNotebookResearch } from "~/modules/notebooks/application/research";
import { NotebookRepository } from "~/modules/notebooks/infrastructure/NotebookRepository";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import { file_in_notebook as descriptor } from "./definitions/file_in_notebook";

async function resolveNotebookId(
  context: ServiceContext,
  input: FileInNotebookInput,
  projectId: string | null,
): Promise<string> {
  const byId = await findNotebookAccess(context, input.notebook);

  if (byId) {
    return byId.notebook.id;
  }

  const repository = context.repositories.get(NotebookRepository);
  const notebooks = projectId
    ? await repository.listProjectNotebooks(projectId)
    : await repository.listPersonalNotebooks(context.requireUser().id);
  const wanted = input.notebook.trim().toLowerCase();
  const match = notebooks.find((notebook) => notebook.normalised_name === wanted);

  if (match) {
    return match.id;
  }

  if (!input.create) {
    throw new AssistantError(
      `No notebook called "${input.notebook}". Pass create: true to make it, or choose one of: ${
        notebooks.map((notebook) => notebook.title).join(", ") || "none yet"
      }.`,
      ErrorType.NOT_FOUND,
      404,
    );
  }

  const created = await createNotebook(context, {
    name: input.notebook.trim().slice(0, 40),
    scope: projectId ? { kind: "project", projectId } : { kind: "personal" },
  });

  return created.id;
}

export const file_in_notebook: ApiToolDefinition = {
  ...descriptor,
  execute: async (args: unknown, toolContext) => {
    const request = toolContext.request;

    if (!request.context || !request.user?.id) {
      throw new AssistantError(
        "Filing in a notebook needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const context = request.context;
    const input = fileInNotebookInputSchema.parse(args);
    const notebookId = await resolveNotebookId(context, input, resolveRequestProjectId(request));
    const filed: string[] = [];

    if (input.sourceIds && input.sourceIds.length > 0) {
      await linkNotebookSources(context, notebookId, input.sourceIds);
      filed.push(`${input.sourceIds.length} source${input.sourceIds.length === 1 ? "" : "s"}`);
    }

    if (input.url) {
      await importNotebookResearch(context, notebookId, {
        results: [{ title: input.title ?? input.url, url: input.url }],
      });
      filed.push("the page");
    }

    if (input.note) {
      await createNotebookNote(context, notebookId, input.note);
      filed.push("a note");
    }

    return {
      status: "success",
      name: NOTEBOOK_FILE_TOOL_NAME,
      content:
        filed.length > 0
          ? `Filed ${filed.join(", ")} in the notebook.`
          : "Nothing to file: give sourceIds, a url or a note.",
      data: { notebookId, filed },
    } satisfies IFunctionResponse;
  },
};
