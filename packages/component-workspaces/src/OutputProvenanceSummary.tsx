import type { OutputProvenance } from "@ngriffin_uk/polychat-schemas";

export interface OutputProvenanceSummaryProps {
  provenance: OutputProvenance;
}

export function OutputProvenanceSummary({ provenance }: OutputProvenanceSummaryProps) {
  if (provenance.completeness === "legacy") {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Origin details are unavailable for this legacy output.
      </p>
    );
  }

  const hasReferences =
    provenance.sources.length > 0 ||
    provenance.skills.length > 0 ||
    provenance.approvals.length > 0;

  return (
    <section aria-label="Output provenance" className="text-xs text-zinc-500 dark:text-zinc-400">
      <p>
        {provenance.origin === "generated" ? "Generated" : "Created"}
        {provenance.model
          ? ` with ${provenance.model.id} via ${provenance.model.provider}`
          : " with incomplete model details"}
        {provenance.run ? ` · run ${provenance.run.id}, attempt ${provenance.run.attempt}` : ""}
      </p>
      <p className="mt-1">
        {provenance.sources.length} source reference
        {provenance.sources.length === 1 ? "" : "s"} · {provenance.skills.length} effective skill
        {provenance.skills.length === 1 ? "" : "s"} · {provenance.approvals.length} approval
        {provenance.approvals.length === 1 ? "" : "s"}
        {provenance.completeness === "partial" ? " · partial record" : ""}
      </p>
      {hasReferences && (
        <details className="mt-1">
          <summary className="cursor-pointer font-medium text-zinc-600 dark:text-zinc-300">
            Inspect origin details
          </summary>
          <dl className="mt-1 grid gap-1 pl-3">
            {provenance.skills.map((skill) => (
              <div key={skill.id}>
                <dt className="inline font-medium">Skill: </dt>
                <dd className="inline">
                  {skill.name}
                  {skill.revision ? ` · r${skill.revision}` : " · revision unavailable"}
                </dd>
              </div>
            ))}
            {provenance.sources.map((source) => (
              <div key={source.id}>
                <dt className="inline font-medium">Source: </dt>
                <dd className="inline">
                  {source.name ?? source.id} · {source.state}
                </dd>
              </div>
            ))}
            {provenance.approvals.map((approval) => (
              <div key={approval.id}>
                <dt className="inline font-medium">Approval: </dt>
                <dd className="inline">
                  {approval.toolName ?? approval.type} · {approval.status}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 pl-3">References remain subject to current access and retention.</p>
        </details>
      )}
    </section>
  );
}
