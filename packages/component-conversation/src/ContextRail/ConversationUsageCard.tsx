import { WorkbenchCard, WorkbenchFact } from "@ngriffin_uk/polychat-component-ui";
import type { ConversationUsageSummary } from "@ngriffin_uk/polychat-library-chat/conversation-insights";
import {
  formatStatsCost,
  formatStatsTokens,
} from "@ngriffin_uk/polychat-library-chat/response-stats";
import type { ChatRunUsage } from "@ngriffin_uk/polychat-schemas";
import { ArrowDownToLine, ArrowUpFromLine, Coins, MessagesSquare, Receipt } from "lucide-react";

import { delegatedUsageLabel, runTotalLabel } from "./labels.js";

export function ConversationUsageCard({
  summary,
  runUsage,
}: {
  summary: ConversationUsageSummary;
  runUsage?: ChatRunUsage;
}) {
  if (summary.replies === 0 && !runUsage) {
    return null;
  }

  return (
    <WorkbenchCard
      title="Usage"
      icon={Receipt}
      aside={
        summary.estimatedCostUsd !== undefined ? (
          <span className="font-mono text-[11px] text-foreground tabular-nums">
            ~{formatStatsCost(summary.estimatedCostUsd)}
          </span>
        ) : undefined
      }
    >
      <div className="space-y-0.5">
        <WorkbenchFact
          icon={MessagesSquare}
          label="Replies"
          value={summary.replies.toLocaleString()}
        />
        {summary.inputTokens > 0 ? (
          <WorkbenchFact
            icon={ArrowUpFromLine}
            label="Tokens sent"
            value={formatStatsTokens(summary.inputTokens)}
          />
        ) : null}
        {summary.outputTokens > 0 ? (
          <WorkbenchFact
            icon={ArrowDownToLine}
            label="Tokens back"
            value={formatStatsTokens(summary.outputTokens)}
          />
        ) : null}
        {runUsage ? (
          <>
            <WorkbenchFact icon={Coins} label="Latest run" value={runTotalLabel(runUsage)} />
            {runUsage.delegated?.map((delegated) => (
              <WorkbenchFact
                key={delegated.delegationId}
                label={delegated.teammateName ?? "Teammate"}
                value={delegatedUsageLabel(delegated)}
              />
            ))}
          </>
        ) : null}
      </div>
    </WorkbenchCard>
  );
}
