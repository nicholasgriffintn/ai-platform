import { RunCostMeter } from "@ngriffin_uk/polychat-component-content";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useRunCostEstimate, useUsageStore } from "@ngriffin_uk/polychat-library-react";
import { isAgentExecutionMode } from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";
import { useShallow } from "zustand/react/shallow";

export interface RunCostStatusProps {
  conversationId?: string;
  historyCharacters: number;
  isRunning: boolean;
  awaitingApproval: boolean;
  projectId?: string;
}

export function RunCostStatus({
  conversationId,
  historyCharacters,
  isRunning,
  awaitingApproval,
  projectId,
}: RunCostStatusProps) {
  const { chatInput, chatMode, isAuthenticated, model, runCapCredits } = useChatStore(
    useShallow((state) => ({
      chatInput: state.chatInput,
      chatMode: state.chatMode,
      isAuthenticated: state.isAuthenticated,
      model: state.model,
      runCapCredits: state.chatSettings.run_cap_credits,
    })),
  );
  const runMeter = useUsageStore((state) => state.runMeter);
  const meter = runMeter?.conversationId === conversationId ? runMeter?.meter : undefined;
  const showMeter = meter && (isRunning || awaitingApproval);
  const wantsEstimate =
    isAuthenticated &&
    !isRunning &&
    (runCapCredits !== undefined || isAgentExecutionMode(chatMode));
  const { data: estimate } = useRunCostEstimate({
    enabled: wantsEstimate,
    model,
    mode: chatMode,
    draft: chatInput,
    historyCharacters,
    projectId,
  });

  if (showMeter) {
    return (
      <div className="px-1 pb-2">
        <RunCostMeter meter={meter} paused={awaitingApproval} />
      </div>
    );
  }

  if (!wantsEstimate || !estimate || estimate.basis !== "rates") {
    return null;
  }

  return (
    <p className="px-1 pb-2 text-xs text-muted-foreground">
      Likely about {formatCredits(estimate.likely_credits)} credits
      {estimate.max_steps > 1
        ? `, up to ${formatCredits(estimate.ceiling_credits)} at the ${estimate.max_steps}-step limit`
        : ""}
      {runCapCredits !== undefined ? `. Capped at ${formatCredits(runCapCredits)}.` : "."}
    </p>
  );
}
