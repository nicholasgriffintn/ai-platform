import { quoteShellArgument } from "@ngriffin_uk/polychat-utility-core";

import { runContainerCommand, type ContainerExecutor } from "./container-command.js";

export interface ContainerFileChange {
  path: string;
  changeType: "create" | "modify" | "delete" | "move";
  isDirectory: boolean;
}

const IGNORED_DIRECTORIES = "(^|/)(\\.git|node_modules|\\.venv|__pycache__)(/|$)";

export function parseInotifyLine(line: string): ContainerFileChange | null {
  const separator = line.indexOf("|");

  if (separator <= 0) {
    return null;
  }

  const events = line.slice(0, separator).split(",");
  const path = line.slice(separator + 1).trim();
  const changeType = events.includes("DELETE")
    ? "delete"
    : events.includes("CREATE")
      ? "create"
      : events.some((event) => event.startsWith("MOVED"))
        ? "move"
        : events.includes("MODIFY") || events.includes("CLOSE_WRITE")
          ? "modify"
          : null;

  return path && changeType ? { path, changeType, isDirectory: events.includes("ISDIR") } : null;
}

export async function watchContainerFiles(
  container: ContainerExecutor,
  params: {
    path: string;
    signal: AbortSignal;
    onChange: (change: ContainerFileChange) => Promise<void> | void;
  },
): Promise<void> {
  let pending = "";

  await runContainerCommand(
    container,
    `inotifywait -m -r -q --exclude ${quoteShellArgument(IGNORED_DIRECTORIES)} -e create,modify,delete,move --format '%e|%w%f' ${quoteShellArgument(params.path)}`,
    {
      signal: params.signal,
      onOutput: async (output) => {
        if (output.stream !== "stdout") {
          return;
        }

        const lines = (pending + output.data).split("\n");

        pending = lines.pop() ?? "";

        for (const line of lines) {
          const change = parseInotifyLine(line);

          if (change) {
            await params.onChange(change);
          }
        }
      },
    },
  ).catch(() => undefined);
}
