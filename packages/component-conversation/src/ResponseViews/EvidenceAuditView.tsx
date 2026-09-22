import { Badge } from "@ngriffin_uk/polychat-component-ui";
import { evidenceAuditToolDataSchema, type EvidenceVerdict } from "@ngriffin_uk/polychat-schemas";
import { ExternalLink } from "lucide-react";

const verdictPresentation: Record<
  EvidenceVerdict,
  { label: string; variant: "success" | "warning" | "secondary" | "destructive" }
> = {
  supported: { label: "Supported", variant: "success" },
  partially_supported: { label: "Partly supported", variant: "warning" },
  unsupported: { label: "Unsupported", variant: "secondary" },
  contradicted: { label: "Contradicted", variant: "destructive" },
};

export function EvidenceAuditView({ data }: { data: unknown }) {
  const parsed = evidenceAuditToolDataSchema.safeParse(data);
  const findings = parsed.success ? parsed.data.findings : [];

  if (findings.length === 0) {
    return <p className="text-sm text-muted-foreground">No evidence findings were returned.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {findings.length} {findings.length === 1 ? "claim" : "claims"} checked against cited sources
      </p>
      <ul className="space-y-2">
        {findings.map((finding) => {
          const presentation = verdictPresentation[finding.verdict];

          return (
            <li key={finding.id} className="rounded-md border border-border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant={presentation.variant}>{presentation.label}</Badge>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(finding.confidence * 100)}% confidence
                </span>
              </div>
              <p className="text-sm text-foreground">{finding.claim}</p>
              {finding.sources.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {finding.sources.map((source, index) => (
                    <li key={source}>
                      <a
                        href={source}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        Source {index + 1}
                        <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
