import { Badge, Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { SITE_PALETTE_DEFINITIONS } from "@ngriffin_uk/polychat-library-sites";
import type { SiteIssue, SitePlan, SiteQuality } from "@ngriffin_uk/polychat-schemas";
import { Wrench } from "lucide-react";

const KIND_LABELS: Record<SitePlan["kind"], string> = {
  landing: "Landing page",
  marketing: "Marketing site",
  portfolio: "Portfolio",
  dashboard: "Dashboard",
  app: "Application",
  form: "Form",
  docs: "Documentation",
  component: "Component",
};

const SCOPE_LABELS: Record<SitePlan["scope"], string> = {
  component: "one component",
  page: "one page",
  site: "several pages",
};

export interface SitePlanSummaryProps {
  plan: SitePlan;
  issues?: SiteIssue[];
  quality?: SiteQuality | null;
  model?: { provider: string; model: string } | null;
  onRepair?: () => void;
  isRepairing?: boolean;
  className?: string;
}

export function SitePlanSummary({
  plan,
  issues = [],
  quality,
  model,
  onRepair,
  isRepairing,
  className,
}: SitePlanSummaryProps) {
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const decided = Boolean(plan.answers);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">
          {KIND_LABELS[plan.kind]}, {SCOPE_LABELS[plan.scope]}
        </span>
        <span className="text-muted-foreground">
          {decided ? `Jev, ${Math.round(plan.confidence * 100)}% sure` : "Heuristic plan"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{plan.tier} tier</Badge>
        <Badge variant="secondary">{plan.tone}</Badge>
        <Badge variant="secondary">{SITE_PALETTE_DEFINITIONS[plan.theme.palette].label}</Badge>
        <Badge variant="secondary">{plan.theme.font}</Badge>
        {plan.theme.mode === "dark" && <Badge variant="secondary">dark</Badge>}
        {plan.interactive && <Badge variant="secondary">interactive</Badge>}
        {warnings > 0 && (
          <Badge variant="outline">
            {warnings} {warnings === 1 ? "repair" : "repairs"}
          </Badge>
        )}
      </div>
      {model && (
        <span
          className="truncate text-muted-foreground"
          title={`${model.provider} · ${model.model}`}
        >
          {model.model}
        </span>
      )}
      {quality && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
          <Badge variant={quality.coverage >= 0.75 ? "secondary" : "outline"}>
            {Math.round(quality.coverage * 100)}% of the brief
          </Badge>
          {quality.placeholders >= 0.65 && <Badge variant="outline">placeholder copy</Badge>}
          {quality.coherent < 0.5 && <Badge variant="outline">pages disagree</Badge>}
          {quality.needsRepair && onRepair && (
            <Button
              variant="outline"
              size="xs"
              icon={<Wrench size={12} />}
              onClick={onRepair}
              isLoading={isRepairing}
              className="ml-auto"
            >
              Repair
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
