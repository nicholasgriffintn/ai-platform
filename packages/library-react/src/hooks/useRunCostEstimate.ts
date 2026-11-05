import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { ResponseCostEstimateRequest } from "@ngriffin_uk/polychat-schemas";
import { useDebouncedValue } from "@ngriffin_uk/polychat-utility-react";
import { useQuery } from "@tanstack/react-query";

const ESTIMATE_DEBOUNCE_MS = 600;
const CHARACTERS_PER_TOKEN = 4;

export interface RunCostEstimateInput {
  enabled: boolean;
  model?: string | null;
  mode?: ResponseCostEstimateRequest["mode"];
  draft: string;
  historyCharacters: number;
  projectId?: string;
}

export function useRunCostEstimate(input: RunCostEstimateInput) {
  const draft = useDebouncedValue(input.draft.trim(), ESTIMATE_DEBOUNCE_MS);
  const historyTokens = Math.ceil(input.historyCharacters / CHARACTERS_PER_TOKEN);
  const { model, mode, projectId } = input;

  return useQuery({
    queryKey: ["run-cost-estimate", model, mode, draft, historyTokens, projectId],
    queryFn: ({ signal }) =>
      apiService.estimateResponseCost(
        {
          model: model ?? "",
          mode,
          input: draft,
          history_tokens: historyTokens,
          project_id: projectId,
        },
        signal,
      ),
    enabled: input.enabled && Boolean(model) && draft.length > 0,
    staleTime: 60 * 1000,
    retry: false,
  });
}
