import { Card, WorkbenchFact } from "@ngriffin_uk/polychat-component-ui";
import { useSkillOutcomes } from "@ngriffin_uk/polychat-library-react";
import type { SkillOutcomeSummary } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { Activity, MessageSquareWarning, ThumbsDown, ThumbsUp } from "lucide-react";

const VERDICT_COPY: Record<SkillOutcomeSummary["verdict"], string> = {
  new: "Too new to judge. Give it a few runs.",
  healthy: "Used recently and not marked down. Nothing to do.",
  unused: "Not used lately. Retire it if the need has passed.",
  struggling: "Replies that used it keep being marked down. Revise the instructions or retire it.",
};

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function SkillOutcomesCard({ skillId, projectId }: { skillId: string; projectId?: string }) {
  const outcomes = useSkillOutcomes(skillId, projectId);
  const summary = outcomes.data;

  if (!summary) {
    return null;
  }

  return (
    <Card className="mt-6 space-y-3 p-6 shadow-none">
      <div>
        <h2 className="text-sm font-semibold text-foreground">How it is doing</h2>
        <p className="text-sm text-muted-foreground">{VERDICT_COPY[summary.verdict]}</p>
      </div>
      <div className="space-y-0.5">
        <WorkbenchFact
          icon={Activity}
          label={`${countLabel(summary.usesInWindow, "use")} in the last ${summary.windowDays} days, ${countLabel(summary.usesTotal, "use")} overall`}
        />
        <WorkbenchFact
          icon={ThumbsUp}
          label={`${countLabel(summary.thumbsUp, "reply")} marked up`}
        />
        <WorkbenchFact
          icon={ThumbsDown}
          label={`${countLabel(summary.thumbsDown, "reply")} marked down`}
        />
        <WorkbenchFact
          icon={MessageSquareWarning}
          label={`${countLabel(summary.corrections, "correction")} in conversations that used it`}
        />
      </div>
      {summary.lastUsedAt ? (
        <p className="text-xs text-muted-foreground">
          Last used {formatRelativeTime(summary.lastUsedAt)}.
        </p>
      ) : null}
    </Card>
  );
}
