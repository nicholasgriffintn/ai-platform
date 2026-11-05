import { runWithWorkspaceFunding } from "@ngriffin_uk/polychat-ai-billing";
import { createFakeRuntime } from "@ngriffin_uk/polychat-ai-billing/testing";
import { ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repositories } from "~/infrastructure/database/repositories";
import { createUsageRuntime } from "~/modules/usage/application/runtime";
import type { IEnv, User } from "~/types";

import { assertTurnAdmitted, resolveTurnAdmission } from "../turn-admission";

vi.mock("~/modules/usage/application/runtime", () => ({ createUsageRuntime: vi.fn() }));

const scope = {
  env: {} as IEnv,
  repositories: {} as Repositories,
  user: { id: 7, plan_id: "pro" } as User,
  provider: "openai",
};
const params = { messages: [] };

describe("resolveTurnAdmission", () => {
  let runtime: ReturnType<typeof createFakeRuntime>;

  beforeEach(() => {
    runtime = createFakeRuntime({ pool: { included_credit_micros: 100_000_000 } });
    runtime.store.hasProviderApiKey.mockResolvedValue(true);
    vi.mocked(createUsageRuntime).mockReturnValue(runtime);
  });

  it("does not let a personal key skip admission in pool-funded work", async () => {
    const admission = await runWithWorkspaceFunding("workspace-1", () =>
      resolveTurnAdmission(scope, params),
    );

    expect(admission).toMatchObject({ admitted: true });
    expect(runtime.store.getWorkspacePool).toHaveBeenCalled();
    expect(runtime.store.getUserBalance).not.toHaveBeenCalled();
  });

  it("keeps a personal key exempt outside a funded workspace", async () => {
    await expect(resolveTurnAdmission(scope, params)).resolves.toBeNull();
  });

  it("explains an exhausted pool in workspace terms", () => {
    const admission = { admitted: false as const, position: {} as never };

    runWithWorkspaceFunding("workspace-1", () => {
      expect(() => assertTurnAdmitted(admission)).toThrowError(/shared credits/);
    });
    expect(() => assertTurnAdmitted(admission)).toThrowError(
      expect.objectContaining({ type: ErrorType.USAGE_LIMIT_ERROR }),
    );
  });
});
