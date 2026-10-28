import {
  PROJECT_TASK_TOOL_IDS,
  WORK_DESKTOP_SHARED_TOOL_IDS,
  WORK_TASK_TOOL_IDS,
} from "@ngriffin_uk/polychat-schemas";
import { randomHex, sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuthChallengeRepository } from "~/modules/auth/infrastructure/AuthChallengeRepository";

export const WORK_MCP_PATH = "/mcp/work";

const WORK_RUN_ACCESS_PROVIDER = "work-run";
const WORK_RUN_ACCESS_TTL_MS = 12 * 60 * 60 * 1000;
const WORK_RUN_TOKEN_PREFIX = "pcwr_";

const workRunAccessSchema = z.object({
  userId: z.number().int().positive(),
  projectId: z.string().min(1),
  teammateContextId: z.string().min(1),
  conversationId: z.string().min(1),
  toolIds: z.array(z.string().min(1)).max(64),
});

export type WorkRunAccess = z.infer<typeof workRunAccessSchema>;

export function workRunToolIds(enabledTools: readonly string[]): string[] {
  return [
    ...PROJECT_TASK_TOOL_IDS,
    ...WORK_TASK_TOOL_IDS,
    ...WORK_DESKTOP_SHARED_TOOL_IDS.filter((toolId) => enabledTools.includes(toolId)),
  ];
}

function tokenKey(token: string): Promise<string> {
  return sha256Hex(`work-run:${token}`);
}

export async function mintWorkRunAccess(
  context: ServiceContext,
  access: WorkRunAccess,
  now = new Date(),
): Promise<string> {
  const token = `${WORK_RUN_TOKEN_PREFIX}${randomHex(32)}`;
  const challenges = context.repositories.get(AuthChallengeRepository);

  await challenges.deleteExpiredForProvider(WORK_RUN_ACCESS_PROVIDER, now);
  await challenges.create({
    tokenHash: await tokenKey(token),
    provider: WORK_RUN_ACCESS_PROVIDER,
    kind: "custom",
    payload: workRunAccessSchema.parse(access),
    createdAt: now,
    expiresAt: new Date(now.getTime() + WORK_RUN_ACCESS_TTL_MS),
    attempts: 0,
  });

  return token;
}

export async function resolveWorkRunAccess(
  context: ServiceContext,
  token: string | null,
  now = new Date(),
): Promise<WorkRunAccess | null> {
  if (!token?.startsWith(WORK_RUN_TOKEN_PREFIX)) {
    return null;
  }

  const record = await context.repositories
    .get(AuthChallengeRepository)
    .findByTokenHash(await tokenKey(token));

  if (
    !record ||
    record.provider !== WORK_RUN_ACCESS_PROVIDER ||
    record.expiresAt.getTime() <= now.getTime()
  ) {
    return null;
  }

  const access = workRunAccessSchema.safeParse(record.payload);

  return access.success ? access.data : null;
}
