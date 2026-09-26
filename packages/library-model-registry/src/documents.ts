import type {
  DatasetProfile,
  EvalRun,
  ModelAsset,
  ModelEvidence,
  ModelVersion,
  ModificationCompute,
} from "@ngriffin_uk/polychat-schemas";
import { formatParameterCount } from "@ngriffin_uk/polychat-utility-core";

export interface ModelCardInput {
  asset: ModelAsset;
  version: ModelVersion;
  base: { name: string; revision: string } | null;
  datasets: Array<{ name: string; profile: DatasetProfile | null }>;
  evidence: readonly ModelEvidence[];
  evalRuns: readonly EvalRun[];
  compute: ModificationCompute | null;
  intendedUse: string | null;
}

function line(label: string, value: string | null | undefined): string | null {
  return value ? `- **${label}:** ${value}` : null;
}

export function renderModelCard(input: ModelCardInput): string {
  const { asset, version } = input;
  const attributes = version.attributes;
  const sections = [
    `# ${asset.displayName}`,
    [
      line("Revision", version.revision),
      line("Kind", asset.kind),
      line("Source", `${asset.source} · ${asset.sourceRef}`),
      line("Licence", attributes.licence ?? "not declared"),
      line(
        "Parameters",
        attributes.parameterCount === null ? null : formatParameterCount(attributes.parameterCount),
      ),
      line("Architecture", attributes.architecture?.modelType ?? null),
      line(
        "Context length",
        attributes.architecture?.contextLength?.toLocaleString("en-GB") ?? null,
      ),
      line("Base", input.base ? `${input.base.name} @ ${input.base.revision}` : null),
    ]
      .filter(Boolean)
      .join("\n"),
    "## Intended use",
    input.intendedUse?.trim() || "Not stated.",
    "## Training data",
    input.datasets.length
      ? input.datasets
          .map(({ name, profile }) =>
            profile
              ? `- ${name}: ${profile.rows.toLocaleString("en-GB")} rows, about ${profile.tokens.toLocaleString("en-GB")} tokens, ${profile.governance.licence} licence, lawful basis ${profile.governance.lawfulBasis.replace(/_/g, " ")}${profile.processedAt ? "" : " (processing)"}`
              : `- ${name}`,
          )
          .join("\n")
      : "No training data recorded; this version was imported.",
    "## Evaluation",
    input.evalRuns.filter((run) => run.status === "completed").length
      ? input.evalRuns
          .filter((run) => run.status === "completed")
          .map(
            (run) =>
              `- Run ${run.id} (${run.trigger}): ${Object.entries(run.scores)
                .map(
                  ([metric, score]) =>
                    `${metric} ${score.mean.toFixed(2)} [${score.low.toFixed(2)}–${score.high.toFixed(2)}]`,
                )
                .join(", ")}`,
          )
          .join("\n")
      : "No completed evaluation runs.",
    "## Evidence",
    input.evidence.length
      ? input.evidence
          .map((item) => `- ${item.kind} (${item.status}, ${item.source}): ${item.summary}`)
          .join("\n")
      : "No evidence recorded.",
    "## Compute",
    input.compute
      ? `Estimated modification compute ${input.compute.modificationFlops.toExponential(2)} FLOPs, ${(input.compute.ratio * 100).toFixed(2)}% of the EU AI Act one-third threshold (${input.compute.basis} basis).`
      : "Not a modification of another model, or compute unknown.",
  ];

  return `${sections.join("\n\n")}\n`;
}
