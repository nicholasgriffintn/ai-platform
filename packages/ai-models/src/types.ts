import type { ReasoningEffort } from "@ngriffin_uk/polychat-schemas";

export type CredentialAuthority = "byok" | "platform";

export type ReasoningEffortLevel = ReasoningEffort;

export type VerbosityLevel = "low" | "medium" | "high" | "caveman";

export interface AccountPlan {
  plan_id: string | null;
}
