import { quoteShellArgument } from "@ngriffin_uk/polychat-utility-core";

export function withSandboxEnvironment(
  command: string,
  values: Record<string, string> | undefined,
  names: readonly string[],
): string {
  if (!values || names.length === 0) {
    return command;
  }

  const assignments = names
    .filter((name) => Object.hasOwn(values, name))
    .map((name) => `export ${name}=${quoteShellArgument(values[name] ?? "")}`);

  return assignments.length > 0 ? `${assignments.join(" && ")} && ${command}` : command;
}
