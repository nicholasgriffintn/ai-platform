import type {
  EvalRun,
  LineageEdge,
  ModelAsset,
  ModelDecision,
  ModelEvidence,
  ModelRoute,
  ModelVersion,
  ModelVersionFile,
} from "@ngriffin_uk/polychat-schemas";

export interface BomVersionInput {
  asset: ModelAsset;
  version: ModelVersion;
  files: readonly ModelVersionFile[];
}

export interface BuildMlBomInput {
  serialNumber: string;
  generatedAt: string;
  subject: BomVersionInput;
  ancestors: readonly BomVersionInput[];
  lineage: readonly LineageEdge[];
  evidence: readonly ModelEvidence[];
  decisions: readonly ModelDecision[];
  evalRuns: readonly EvalRun[];
  route: ModelRoute | null;
}

type BomProperty = { name: string; value: string };

function bomRef(versionId: string): string {
  return `polychat:version:${versionId}`;
}

function packageUrl({ asset, version }: BomVersionInput): string | undefined {
  if (asset.source !== "huggingface") {
    return undefined;
  }

  return `pkg:huggingface/${asset.sourceRef}@${version.revision}`;
}

function toComponent(input: BomVersionInput, extra: Record<string, unknown> = {}) {
  const { asset, version, files } = input;
  const licence = version.attributes.licence;

  return {
    type: asset.kind === "dataset" ? "data" : "machine-learning-model",
    "bom-ref": bomRef(version.id),
    name: asset.sourceRef,
    version: version.revision,
    purl: packageUrl(input),
    licenses: licence ? [{ license: { id: licence } }] : undefined,
    components: files
      .filter((file) => file.sha256)
      .map((file) => ({
        type: "file",
        name: file.path,
        hashes: [{ alg: "SHA-256", content: file.sha256 }],
      })),
    ...extra,
  };
}

export function buildMlBom(input: BuildMlBomInput) {
  const { subject, evidence, decisions, evalRuns, route } = input;
  const performanceMetrics = evalRuns
    .filter((run) => run.status === "completed")
    .flatMap((run) =>
      Object.entries(run.scores).map(([metric, score]) => ({
        type: metric,
        value: score.mean.toFixed(4),
        slice: `run:${run.id}`,
        confidenceInterval: { lowerBound: score.low.toFixed(4), upperBound: score.high.toFixed(4) },
      })),
    );
  const properties: BomProperty[] = [
    ...evidence.map((item) => ({
      name: `polychat:evidence:${item.kind}`,
      value: `${item.status} (${item.source}, ${item.observedAt}): ${item.summary}`,
    })),
    ...decisions.map((decision) => ({
      name: "polychat:decision",
      value: `${decision.state} ${decision.projectId ? `project ${decision.projectId}` : "workspace"} verdict=${decision.verdict.effect} policies=${decision.verdict.policyHashes.join(",")}`,
    })),
  ];

  if (route) {
    properties.push(
      { name: "polychat:route:provider", value: route.provider },
      { name: "polychat:route:model", value: route.providerModelId },
      { name: "polychat:route:region", value: route.region },
      { name: "polychat:route:weights-verified", value: String(route.weightsVerified) },
    );
  }

  const main = toComponent(subject, {
    modelCard:
      subject.asset.kind === "model"
        ? {
            modelParameters: {
              task: subject.version.attributes.pipelineTag ?? undefined,
              datasets: input.lineage
                .filter(
                  (edge) =>
                    edge.relation === "trained_on" && edge.toVersionId === subject.version.id,
                )
                .map((edge) => ({ ref: bomRef(edge.fromVersionId) })),
            },
            quantitativeAnalysis:
              performanceMetrics.length > 0 ? { performanceMetrics } : undefined,
          }
        : undefined,
    properties,
  });

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${input.serialNumber}`,
    version: 1,
    metadata: {
      timestamp: input.generatedAt,
      tools: { components: [{ type: "application", name: "Polychat Aviary" }] },
      component: main,
    },
    components: input.ancestors.map((ancestor) => toComponent(ancestor)),
    dependencies: [
      {
        ref: bomRef(subject.version.id),
        dependsOn: input.lineage
          .filter((edge) => edge.toVersionId === subject.version.id)
          .map((edge) => bomRef(edge.fromVersionId)),
      },
      ...input.ancestors.map((ancestor) => ({
        ref: bomRef(ancestor.version.id),
        dependsOn: input.lineage
          .filter((edge) => edge.toVersionId === ancestor.version.id)
          .map((edge) => bomRef(edge.fromVersionId)),
      })),
    ],
  };
}
