import {
  fileInNotebookInputSchema,
  NOTEBOOK_FILE_TOOL_NAME,
  type FileInNotebookInput,
} from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "~/types/functions";

export const file_in_notebook: FunctionToolDescriptor = {
  name: NOTEBOOK_FILE_TOOL_NAME,
  description:
    "File something in one of the person's notebooks by name or id: existing sources by id, a web page by URL, or a note you write. Use it when they ask to put, save or file something in a notebook. Set create to true only when they ask for a notebook that does not exist yet.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "draft" },
  intentEvidence: (input: FileInNotebookInput) => ({
    operation: NOTEBOOK_FILE_TOOL_NAME,
    destination: `the person's own notebook ${input.notebook}`,
    sources: input.sourceIds?.length ?? 0,
    url: input.url ?? null,
    note: Boolean(input.note),
  }),
  inputSchema: fileInNotebookInputSchema,
};
