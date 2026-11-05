import { AsyncLocalStorage } from "node:async_hooks";

const fundingStorage = new AsyncLocalStorage<string>();

export function runWithWorkspaceFunding<T>(workspaceId: string, fn: () => T): T {
  return fundingStorage.run(workspaceId, fn);
}

export function currentFundingWorkspaceId(): string | undefined {
  return fundingStorage.getStore();
}
