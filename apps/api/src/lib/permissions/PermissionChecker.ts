import {
  PermissionChecker as SharedPermissionChecker,
  resolveModeMaxSteps as sharedResolveModeMaxSteps,
  resolveToolPermissions as sharedResolveToolPermissions,
  type PermissionCheckInput as SharedPermissionCheckInput,
  type PermissionCheckResult,
  type RequestPermissionCheckInput as SharedRequestPermissionCheckInput,
  type RequestPermissionCheckResult,
} from "@ngriffin_uk/polychat-library-tool-runtime";
import type { ToolPermission } from "@ngriffin_uk/polychat-schemas";

import type { ChatMode, IUser } from "~/types";

export type { PermissionCheckResult, RequestPermissionCheckResult };

export interface PermissionCheckInput extends Omit<SharedPermissionCheckInput, "mode" | "user"> {
  mode?: ChatMode;
  user?: IUser;
}

export interface RequestPermissionCheckInput extends Omit<
  SharedRequestPermissionCheckInput,
  "mode" | "user"
> {
  mode?: ChatMode;
  user?: IUser;
}

export function resolveToolPermissions(
  toolName: string,
  explicitPermissions?: string[],
): ToolPermission[] {
  return sharedResolveToolPermissions(toolName, explicitPermissions);
}

export function resolveModeMaxSteps(mode?: ChatMode, requestedMaxSteps?: number): number {
  return sharedResolveModeMaxSteps(mode, requestedMaxSteps);
}

export class PermissionChecker extends SharedPermissionChecker {
  override checkToolAccess(input: PermissionCheckInput): PermissionCheckResult {
    return super.checkToolAccess(input);
  }

  override checkRequestToolAccess(
    input: RequestPermissionCheckInput,
  ): RequestPermissionCheckResult {
    return super.checkRequestToolAccess(input);
  }
}
