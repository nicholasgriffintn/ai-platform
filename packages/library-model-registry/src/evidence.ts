import type {
  EvidenceKind,
  EvidenceSource,
  EvidenceStatus,
  ModelAssetKind,
} from "@ngriffin_uk/polychat-schemas";

import type { PiiSampleAssessment } from "./datasets.js";
import { collectWeightFormats } from "./inspection/formats.js";
import { classifyPickleImport, summarisePickleScan } from "./inspection/pickle.js";
import type { PickleStreamScan, SafetensorsCheck } from "./inspection/readers.js";
import {
  assessCard,
  assessChatTemplate,
  type RemoteCodeAssessment,
} from "./inspection/repository.js";
import { isPermissiveLicence } from "./licence.js";

export interface EvidenceDraft {
  kind: EvidenceKind;
  source: EvidenceSource;
  status: EvidenceStatus;
  summary: string;
  details: Record<string, unknown>;
}

export interface ScannedFile {
  path: string;
  scanStatus: string;
  scanFindings: readonly string[];
}

export interface PublicEvalResult {
  benchmark: string;
  task: string | null;
  value: number;
  provenance: string;
  sourceUrl: string | null;
}

const NO_HEADERS: SafetensorsCheck = { checked: 0, issues: [], parameterCount: null };

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function licenceEvidence(licence: string | null, raw: unknown): EvidenceDraft {
  return {
    kind: "licence",
    source: "hub_metadata",
    status: licence === null ? "unknown" : isPermissiveLicence(licence) ? "pass" : "warn",
    summary: licence ? `Declared licence ${licence}` : "No licence declared in the card",
    details: { licence, raw: raw ?? null },
  };
}

export function gatingEvidence(gated: boolean): EvidenceDraft {
  return {
    kind: "gating",
    source: "hub_metadata",
    status: gated ? "warn" : "pass",
    summary: gated
      ? "Gated: someone must accept the publisher's terms for the workspace"
      : "Openly downloadable",
    details: { gated },
  };
}

export function hubScanEvidence(files: readonly ScannedFile[]): EvidenceDraft {
  const unsafe = files.filter((file) => file.scanStatus === "unsafe");
  const suspicious = files.filter(
    (file) => file.scanStatus === "suspicious" || file.scanStatus === "caution",
  );

  return {
    kind: "hub_scan",
    source: "hub_scan",
    status: unsafe.length > 0 ? "fail" : suspicious.length > 0 ? "warn" : "pass",
    summary:
      unsafe.length > 0
        ? `Hub scanners flag ${unsafe.map((file) => file.path).join(", ")} as unsafe`
        : suspicious.length > 0
          ? `${suspicious.length} file(s) need a closer look`
          : "No known issues reported by Hub scanners",
    details: {
      findings: files
        .filter((file) => file.scanFindings.length > 0)
        .map((file) => ({ path: file.path, findings: file.scanFindings })),
      unscanned: files.filter(
        (file) => file.scanStatus === "unscanned" || file.scanStatus === "unknown",
      ).length,
    },
  };
}

export function cardEvidence(markdown: string | null, kind: ModelAssetKind): EvidenceDraft {
  const card = assessCard(markdown, kind);

  return {
    kind: "card",
    source: "hub_metadata",
    status: card.status,
    summary:
      card.missing.length === 0
        ? "Card covers every expected section"
        : `Card is missing ${card.missing.join(", ")}`,
    details: { present: card.present, missing: card.missing },
  };
}

export function signatureEvidence(paths: readonly string[]): EvidenceDraft {
  const signatureFiles = paths.filter((path) => path.endsWith(".sig"));

  return {
    kind: "signature",
    source: "static_inspection",
    status: "unknown",
    summary:
      signatureFiles.length > 0
        ? "A detached model signature is present"
        : "No OpenSSF Model Signing bundle published",
    details: { signatureFiles },
  };
}

export function formatEvidence(
  kind: ModelAssetKind,
  paths: readonly string[],
  headers: SafetensorsCheck = NO_HEADERS,
): EvidenceDraft {
  const formats = collectWeightFormats(paths);
  const describe = () => {
    if (kind === "dataset") {
      return `${paths.length} dataset file(s)`;
    }

    if (headers.issues.length > 0) {
      return `${headers.issues.length} safetensors header issue(s)`;
    }

    if (formats.length === 0) {
      return "No recognised weight files";
    }

    const checked = headers.checked > 0 ? `; ${headers.checked} header(s) well formed` : "";

    return `Weights ship as ${formats.join(", ")}${checked}`;
  };

  return {
    kind: "format",
    source: headers.checked > 0 ? "static_inspection" : "hub_metadata",
    status:
      headers.issues.length > 0 || (kind === "model" && formats.includes("pickle"))
        ? "warn"
        : "pass",
    summary: describe(),
    details: { formats, headersChecked: headers.checked, headerIssues: headers.issues },
  };
}

export function remoteCodeEvidence(assessment: RemoteCodeAssessment): EvidenceDraft {
  return {
    kind: "remote_code",
    source: "static_inspection",
    status: assessment.remoteCode ? "warn" : "pass",
    summary: assessment.remoteCode
      ? "Loading runs Python shipped in the repository"
      : "Loads with library code only",
    details: { reasons: assessment.reasons, codeFiles: assessment.codeFiles },
  };
}

export function chatTemplateEvidence(templates: readonly string[]): EvidenceDraft {
  const findings = unique(templates.flatMap((template) => assessChatTemplate(template).findings));

  return {
    kind: "chat_template",
    source: "static_inspection",
    status: findings.length > 0 ? "fail" : "pass",
    summary:
      findings.length > 0
        ? `Chat template uses ${findings.join(", ")}`
        : templates.length > 0
          ? `${templates.length} chat template(s) reviewed`
          : "No chat template shipped",
    details: { templates: templates.length, findings },
  };
}

export function pickleEvidence(input: {
  scans: readonly PickleStreamScan[];
  hubImports: ReadonlyArray<{ module: string; name: string }>;
  failures: readonly string[];
  skippedFiles: readonly string[];
}): EvidenceDraft {
  const hubRisks = input.hubImports.map((item) => ({
    name: `${item.module}.${item.name}`,
    risk: classifyPickleImport(item.module, item.name),
  }));
  const summaries = input.scans.map(({ result }) => summarisePickleScan(result));
  const dangerous = unique([
    ...summaries.flatMap((summary) => summary.dangerous),
    ...hubRisks.filter((item) => item.risk === "dangerous").map((item) => item.name),
  ]);
  const unknown = unique([
    ...summaries.flatMap((summary) => summary.unknown),
    ...hubRisks.filter((item) => item.risk === "unknown").map((item) => item.name),
  ]);
  const parseErrors = input.scans
    .filter(({ result }) => result.error)
    .map(({ label, result }) => `${label}: ${result.error}`);
  const unreadable = parseErrors.length > 0 || input.failures.length > 0;

  return {
    kind: "pickle_imports",
    source: "static_inspection",
    status: dangerous.length > 0 ? "fail" : unknown.length > 0 || unreadable ? "warn" : "pass",
    summary:
      dangerous.length > 0
        ? `Imports code outside the safe set: ${dangerous.slice(0, 5).join(", ")}`
        : unknown.length > 0
          ? `${unknown.length} import(s) are not on the known-safe list`
          : unreadable
            ? "Some pickle data could not be read"
            : `${input.scans.length} pickle stream(s) import only known-safe globals`,
    details: {
      dangerous,
      unknown,
      parseErrors,
      fetchFailures: input.failures,
      scanned: input.scans.map(({ label, result }) => ({
        label,
        opcodes: result.opcodeCount,
        truncated: result.truncated,
      })),
      skippedFiles: input.skippedFiles,
    },
  };
}

export function publicEvalEvidence(result: PublicEvalResult): EvidenceDraft {
  return {
    kind: "public_eval",
    source: "community_eval",
    status: "pass",
    summary: `${result.benchmark}${result.task ? ` (${result.task})` : ""}: ${result.value}`,
    details: { ...result },
  };
}

export function datasetStatsEvidence(totalRows: number | null, sampled: number): EvidenceDraft {
  return {
    kind: "dataset_stats",
    source: "hub_metadata",
    status: totalRows === null ? "unknown" : "pass",
    summary:
      totalRows === null
        ? "The dataset viewer has no statistics for this dataset"
        : `${totalRows.toLocaleString("en-GB")} rows`,
    details: { totalRows, sampled },
  };
}

export function piiEvidence(assessment: PiiSampleAssessment): EvidenceDraft {
  return {
    kind: "pii",
    source: "static_inspection",
    status: assessment.status,
    summary:
      assessment.rowsSampled === 0
        ? "No rows could be sampled"
        : `${assessment.rowsWithPii} of ${assessment.rowsSampled} sampled rows contain personal data patterns`,
    details: { ...assessment },
  };
}
