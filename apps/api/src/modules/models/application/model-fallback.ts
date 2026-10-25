import { isProviderQuotaExhaustedError } from "@ngriffin_uk/polychat-utility-server/provider-errors";

export interface ModelFallback<TSelection> {
  reselect: () => Promise<TSelection | null>;
  sameAs: (left: TSelection, right: TSelection) => boolean;
}

export async function runWithModelFallback<TSelection, TResult>(
  selection: TSelection,
  fallback: ModelFallback<TSelection> | undefined,
  run: (selection: TSelection) => Promise<TResult>,
): Promise<{ selection: TSelection; result: TResult }> {
  try {
    return { selection, result: await run(selection) };
  } catch (error) {
    if (!fallback || !isProviderQuotaExhaustedError(error)) {
      throw error;
    }

    const next = await fallback.reselect().catch(() => null);

    if (!next || fallback.sameAs(next, selection)) {
      throw error;
    }

    return runWithModelFallback(next, fallback, run);
  }
}
