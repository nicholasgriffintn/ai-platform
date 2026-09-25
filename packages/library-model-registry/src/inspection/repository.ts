import type { EvidenceStatus } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export interface RemoteCodeAssessment {
  remoteCode: boolean;
  reasons: string[];
  codeFiles: string[];
}

export function assessRemoteCode(
  config: unknown,
  filePaths: readonly string[],
): RemoteCodeAssessment {
  const reasons: string[] = [];
  const codeFiles = filePaths.filter((path) => path.endsWith(".py"));

  if (isRecord(config) && isRecord(config.auto_map) && Object.keys(config.auto_map).length > 0) {
    reasons.push(`config.json auto_map points at ${Object.keys(config.auto_map).join(", ")}`);
  }

  if (codeFiles.length > 0 && reasons.length > 0) {
    reasons.push(`Repository ships ${codeFiles.length} Python file(s)`);
  }

  return { remoteCode: reasons.length > 0, reasons, codeFiles };
}

const TEMPLATE_RISK_PATTERNS: Array<[RegExp, string]> = [
  [/__class__|__mro__|__subclasses__|__globals__|__builtins__|__init__/, "Python dunder access"],
  [/\bimport\b|\bos\.|popen|subprocess|\beval\(|\bexec\(/, "Code execution primitives"],
  [/\bopen\(|\.read\(\)|\.write\(/, "File access"],
  [/cycler|joiner|namespace\.__/, "Known sandbox escape gadget"],
];

export interface ChatTemplateAssessment {
  status: EvidenceStatus;
  findings: string[];
}

export function assessChatTemplate(template: string | null | undefined): ChatTemplateAssessment {
  if (!template) {
    return { status: "pass", findings: [] };
  }

  const findings = TEMPLATE_RISK_PATTERNS.filter(([pattern]) => pattern.test(template)).map(
    ([, label]) => label,
  );

  return { status: findings.length > 0 ? "fail" : "pass", findings };
}

const MODEL_CARD_SECTIONS: Array<[string, RegExp]> = [
  ["Intended use", /^#+\s*(intended use|uses|use cases|direct use)/im],
  ["Limitations", /^#+\s*(limitations|bias|risks|out-of-scope)/im],
  ["Training data", /^#+\s*(training data|training details|dataset)/im],
  ["Evaluation", /^#+\s*(evaluation|results|benchmarks?|performance)/im],
];

const DATASET_CARD_SECTIONS: Array<[string, RegExp]> = [
  ["Dataset description", /^#+\s*(dataset (description|summary)|about)/im],
  ["Collection process", /^#+\s*(collection|curation|source data|data collection)/im],
  ["Personal information", /^#+\s*(personal|sensitive|pii|privacy)/im],
  ["Licensing", /^#+\s*(licens|terms)/im],
];

export interface CardAssessment {
  status: EvidenceStatus;
  present: string[];
  missing: string[];
}

export function assessCard(markdown: string | null, kind: "model" | "dataset"): CardAssessment {
  const sections = kind === "model" ? MODEL_CARD_SECTIONS : DATASET_CARD_SECTIONS;

  if (!markdown) {
    return { status: "warn", present: [], missing: sections.map(([label]) => label) };
  }

  const present = sections.filter(([, pattern]) => pattern.test(markdown)).map(([label]) => label);
  const missing = sections.map(([label]) => label).filter((label) => !present.includes(label));

  return { status: missing.length === 0 ? "pass" : "warn", present, missing };
}
