import type { ComputeSite, ModelTier } from "@ngriffin_uk/polychat-schemas";
import type { UserSettings } from "@ngriffin_uk/polychat-schemas/user-profile";

export interface AccountModelSelection {
  model: string | null;
  modelTier: ModelTier | null;
  computeSite: ComputeSite;
}

export type AccountModelDefaults = Partial<
  Pick<UserSettings, "default_model_id" | "default_model_tier" | "default_compute_site">
>;

export function resolveAccountModelSelection(
  settings: AccountModelDefaults | null | undefined,
): AccountModelSelection {
  const model = settings?.default_model_id ?? null;

  return {
    model,
    modelTier: model ? null : (settings?.default_model_tier ?? null),
    computeSite: settings?.default_compute_site ?? "hosted",
  };
}
