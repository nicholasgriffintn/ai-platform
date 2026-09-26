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

const SPDX_RELATIONSHIPS: Record<LineageEdge["relation"], string> = {
  fine_tuned_from: "descendantOf",
  adapter_of: "descendantOf",
  merged_from: "descendantOf",
  quantised_from: "descendantOf",
  distilled_from: "descendantOf",
  checkpoint_of: "descendantOf",
  derived_from: "descendantOf",
  trained_on: "trainedOn",
  evaluated_on: "testedOn",
};

function spdxId(versionId: string): string {
  return `urn:polychat:version:${versionId}`;
}

function spdxElement(input: BomVersionInput) {
  const { asset, version, files } = input;
  const common = {
    spdxId: spdxId(version.id),
    creationInfo: "_:creationinfo",
    name: asset.sourceRef,
    software_packageVersion: version.revision,
    software_downloadLocation:
      asset.source === "huggingface"
        ? `https://huggingface.co/${asset.kind === "dataset" ? "datasets/" : ""}${asset.sourceRef}/tree/${version.revision}`
        : "NOASSERTION",
    verifiedUsing: files
      .filter((file) => file.sha256)
      .map((file) => ({
        type: "Hash",
        algorithm: "sha256",
        hashValue: file.sha256,
        comment: file.path,
      })),
  };

  return asset.kind === "dataset"
    ? { type: "dataset_DatasetPackage", ...common, dataset_datasetType: ["text"] }
    : {
        type: "ai_AIPackage",
        ...common,
        ai_typeOfModel: [asset.kind === "adapter" ? "lora-adapter" : "transformer"],
        ai_informationAboutTraining: version.attributes.trainingComputeFlops
          ? `Estimated modification compute ${version.attributes.trainingComputeFlops.toExponential(2)} FLOPs`
          : undefined,
      };
}

export function buildSpdxAiBom(input: BuildMlBomInput) {
  const subjects = [input.subject, ...input.ancestors];
  const elements = subjects.map(spdxElement);
  const relationships = input.lineage.map((edge, index) => ({
    type: "Relationship",
    spdxId: `urn:polychat:relationship:${index}`,
    creationInfo: "_:creationinfo",
    from: spdxId(edge.toVersionId),
    relationshipType: SPDX_RELATIONSHIPS[edge.relation],
    to: [spdxId(edge.fromVersionId)],
  }));
  const licences = subjects.flatMap((subject, index) =>
    subject.version.attributes.licence
      ? [
          {
            type: "Relationship",
            spdxId: `urn:polychat:licence:${index}`,
            creationInfo: "_:creationinfo",
            from: spdxId(subject.version.id),
            relationshipType: "hasDeclaredLicense",
            to: [`https://spdx.org/licenses/${subject.version.attributes.licence}`],
          },
        ]
      : [],
  );

  return {
    "@context": "https://spdx.org/rdf/3.0.1/spdx-context.jsonld",
    "@graph": [
      {
        type: "CreationInfo",
        "@id": "_:creationinfo",
        specVersion: "3.0.1",
        created: input.generatedAt,
        createdBy: ["urn:polychat:tool"],
      },
      {
        type: "Tool",
        spdxId: "urn:polychat:tool",
        name: "Polychat",
        creationInfo: "_:creationinfo",
      },
      ...elements,
      ...relationships,
      ...licences,
      {
        type: "SpdxDocument",
        spdxId: `urn:uuid:${input.serialNumber}`,
        creationInfo: "_:creationinfo",
        profileConformance: ["core", "software", "ai", "dataset"],
        rootElement: [spdxId(input.subject.version.id)],
        element: [
          ...elements.map((element) => element.spdxId),
          ...relationships.map((relationship) => relationship.spdxId),
          ...licences.map((relationship) => relationship.spdxId),
        ],
      },
    ],
  };
}
