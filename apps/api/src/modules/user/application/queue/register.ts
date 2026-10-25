import { SCHEDULES } from "~/config/schedules";
import { providerHost } from "~/infrastructure/providers/host";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";
import { syncProviderQuotas } from "~/modules/user/application/provider-quota";

export function registerUserQueue(workflows: AppWorkflows): void {
  workflows.every(
    SCHEDULES.PROVIDER_QUOTA_SYNC,
    defineSchedule({
      name: "provider-quota-sync",
      run: async ({ env, invokedAt }) => {
        await syncProviderQuotas(providerHost, env, invokedAt);
      },
    }),
  );
}
