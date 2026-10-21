import z from "zod/v4";

import type { FunctionToolDescriptor } from "~/types/functions";

const workspaceSchema = {
  machineId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Which desktop to use when the person has more than one online."),
  directory: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("The granted folder's name or id. Omit when only one folder is granted."),
};

const pathSchema = z
  .string()
  .trim()
  .max(1024)
  .describe("A path relative to the granted folder, such as notes/todo.md.");

function destination(input: { machineId?: string; directory?: string }): string | undefined {
  return input.directory ? `desktop:${input.machineId ?? "any"}/${input.directory}` : undefined;
}

export const desktop_list_directory: FunctionToolDescriptor = {
  name: "desktop_list_directory",
  description:
    "Lists the files and folders inside a folder the person has granted on their Polychat Desktop. Start here before reading or writing anything there.",
  inputSchema: z.object({ ...workspaceSchema, path: pathSchema.default("") }),
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read", destination },
  intentEvidence: (input) => ({ directory: input.directory, path: input.path }),
};

export const desktop_read_file: FunctionToolDescriptor = {
  name: "desktop_read_file",
  description:
    "Reads a text file from a folder the person has granted on their Polychat Desktop. Files over 512 KB are cut short.",
  inputSchema: z.object({ ...workspaceSchema, path: pathSchema.min(1) }),
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read", destination },
  intentEvidence: (input) => ({ directory: input.directory, path: input.path }),
};

export const desktop_search_files: FunctionToolDescriptor = {
  name: "desktop_search_files",
  description:
    "Finds files by name, and optionally by a line of their contents, inside a folder the person has granted on their Polychat Desktop.",
  inputSchema: z.object({
    ...workspaceSchema,
    query: z.string().trim().min(1).max(200).describe("Text to look for in file names."),
    path: pathSchema
      .default("")
      .describe("A sub-folder to search, relative to the granted folder."),
    contents: z
      .boolean()
      .default(false)
      .describe("Also look inside text files and return the first matching line."),
  }),
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read", destination },
  intentEvidence: (input) => ({ directory: input.directory, query: input.query }),
};

export const desktop_write_file: FunctionToolDescriptor = {
  name: "desktop_write_file",
  description:
    "Writes a text file inside a folder the person has granted on their Polychat Desktop. Refuses to replace an existing file unless overwrite is set.",
  inputSchema: z.object({
    ...workspaceSchema,
    path: pathSchema.min(1),
    content: z.string().max(1_000_000),
    overwrite: z.boolean().default(false),
  }),
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write", destination },
  intentEvidence: (input) => ({
    directory: input.directory,
    path: input.path,
    overwrite: input.overwrite,
    bytes: input.content.length,
  }),
};
