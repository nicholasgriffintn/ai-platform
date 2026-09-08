import type { PermissionMode } from "@ngriffin_uk/polychat-schemas";
import { agentRuntimeVendorSchema } from "@ngriffin_uk/polychat-schemas";

import { toRunMessages } from "../lib/run-messages.js";
import { consumeDesktopRun } from "./desktop-run-stream.js";
import type { DeviceModelRunOptions } from "./device-run.js";

export async function streamAgentProcessRun({
  backend,
  model,
  messages,
  onContent,
  signal,
  permissionMode,
  onStatus,
}: DeviceModelRunOptions & {
  permissionMode: PermissionMode;
  onStatus: (message: string) => void;
}): Promise<string> {
  const driver = agentRuntimeVendorSchema.parse(model.matchingModel);
  const probe = await backend.probeAgentTool(driver);

  if (probe.state !== "ready") {
    throw new Error(`Configure and sign in to ${model.name} before sending.`);
  }

  if (!model.agent?.permissionModes.includes(permissionMode)) {
    throw new Error(`${model.name} does not support the selected permission mode.`);
  }

  signal.throwIfAborted();
  onStatus(`Choose the project folder where ${model.name} should work with your files.`);
  const path = await backend.pickAgentDirectory();

  if (!path) {
    throw new Error("Choose a working folder to start the agent.");
  }

  signal.throwIfAborted();
  const directory = await backend.saveAgentDirectory(path);

  signal.throwIfAborted();
  onStatus(`Starting ${model.name} in ${directory.label}…`);
  const run = await backend.startAgentProcessRun({
    driver,
    directoryId: directory.id,
    prompt: toRunMessages(messages)
      .map((message) => `${message.role}:\n${message.content}`)
      .join("\n\n"),
    session: null,
    model: null,
    permissionMode,
    acknowledgeDirty: false,
  });

  return consumeDesktopRun(run, onContent, signal);
}
