import type { getSandbox } from "@cloudflare/sandbox";

type ScriptSandbox = Pick<
  ReturnType<typeof getSandbox>,
  "createCodeContext" | "runCode" | "deleteCodeContext"
>;

export async function runSandboxScript(
  sandbox: ScriptSandbox,
  code: string,
  language: "python" | "javascript" | "typescript",
  cwd: string,
) {
  const context = await sandbox.createCodeContext({ language, cwd });

  try {
    const directory = JSON.stringify(cwd);
    const initialisation = await sandbox.runCode(
      language === "python"
        ? `__import__("os").chdir(${directory})`
        : `process.chdir(${directory});`,
      { context, language },
    );

    if (initialisation.error) {
      throw new Error(
        `Could not set the script working directory: ${initialisation.error.message}`,
      );
    }

    return await sandbox.runCode(code, { context, language });
  } finally {
    await sandbox.deleteCodeContext(context.id).catch(() => {});
  }
}
