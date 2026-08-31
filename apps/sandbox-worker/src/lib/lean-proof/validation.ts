import type { getSandbox } from "@cloudflare/sandbox";
import type {
  LeanProofDiagnostic,
  LeanProofEvidence,
  LeanProofOutcome,
} from "@ngriffin_uk/polychat-schemas";

import { quoteForShell, runSandboxCommand } from "../commands";
import { assertLeanTargetFileLimits } from "./file-limits";

const DIAGNOSTIC_PATTERN = /^(.*?):(\d+):(\d+):\s*(error|warning|info(?:rmation)?):\s*(.*)$/i;
const RISK_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "unfinished proof (`sorry`)", pattern: /\bsorry\b/ },
  { label: "unfinished proof (`admit`)", pattern: /\badmit\b/ },
  { label: "new axiom declaration", pattern: /^\s*axiom\b/m },
  { label: "unsafe declaration", pattern: /^\s*unsafe\b/m },
  { label: "partial declaration", pattern: /^\s*partial\b/m },
  { label: "external implementation", pattern: /^\s*extern\b/m },
  { label: "implementation substitution", pattern: /\bimplemented_by\b/ },
];
const ALLOWED_AXIOMS = new Set(["propext", "Quot.sound", "Classical.choice"]);

export interface LeanSourceRisk {
  path: string;
  summary: string;
}

export interface LeanValidationResult {
  outcome: LeanProofOutcome;
  diagnostics: LeanProofDiagnostic[];
  evidence: LeanProofEvidence[];
  sourceRisks: LeanSourceRisk[];
}

export function assertLeanProofNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Lean proof run cancelled", "AbortError");
  }
}

export function parseLeanDiagnostics(
  output: string,
  repositoryRoot?: string,
): LeanProofDiagnostic[] {
  const diagnostics: LeanProofDiagnostic[] = [];

  for (const rawLine of output.split("\n")) {
    const match = rawLine.trim().match(DIAGNOSTIC_PATTERN);

    if (!match) {
      continue;
    }

    const rawPath = match[1];
    const relativePath = repositoryRoot
      ? rawPath.replace(`${repositoryRoot.replace(/\/+$/, "")}/`, "")
      : rawPath;
    const severity = match[4].toLowerCase();

    diagnostics.push({
      severity: severity === "error" ? "error" : severity === "warning" ? "warning" : "information",
      message: match[5].trim().slice(0, 4000),
      path: relativePath.startsWith("/") ? null : relativePath,
      line: Number(match[2]),
      column: Number(match[3]),
      endLine: null,
      endColumn: null,
      code: null,
    });
  }

  return diagnostics;
}

export function scanRiskyLeanSource(path: string, source: string): LeanSourceRisk[] {
  return RISK_PATTERNS.flatMap(({ label, pattern }) =>
    pattern.test(source) ? [{ path, summary: `Detected ${label}.` }] : [],
  );
}

export function parseAxiomAudit(output: string): { passed: boolean; summaries: string[] } {
  const summaries: string[] = [];
  let foundAudit = false;

  for (const line of output.split("\n")) {
    if (line.includes("does not depend on any axioms")) {
      foundAudit = true;
      continue;
    }

    if (!line.includes("axioms:")) {
      continue;
    }

    foundAudit = true;
    const start = line.indexOf("[");
    const end = line.lastIndexOf("]");

    if (start < 0 || end < start) {
      summaries.push("Lean returned an unrecognised axiom audit response.");
      continue;
    }

    const axioms = line
      .slice(start + 1, end)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const unexpected = axioms.filter((axiom) => !ALLOWED_AXIOMS.has(axiom));

    if (unexpected.length > 0) {
      summaries.push(`Unexpected axioms: ${unexpected.join(", ")}`);
    }
  }

  if (!foundAudit) {
    summaries.push("Lean did not return axiom audit output.");
  }

  return { passed: summaries.length === 0, summaries };
}

function toModuleName(path: string): string {
  return path
    .replace(/\.lean$/, "")
    .split("/")
    .join(".");
}

export async function validateLeanProof(params: {
  sandbox: ReturnType<typeof getSandbox>;
  repositoryRoot: string;
  targetPaths: string[];
  declarations: string[];
  abortSignal?: AbortSignal;
}): Promise<LeanValidationResult> {
  const diagnostics: LeanProofDiagnostic[] = [];
  const evidence: LeanProofEvidence[] = [];
  const sourceRisks: LeanSourceRisk[] = [];
  const targetFiles = await assertLeanTargetFileLimits({
    sandbox: params.sandbox,
    repositoryRoot: params.repositoryRoot,
    targetPaths: params.targetPaths,
  });

  for (const targetFile of targetFiles) {
    assertLeanProofNotCancelled(params.abortSignal);

    const source = await params.sandbox.readFile(targetFile.resolvedPath);

    if (!source.success) {
      throw new Error(`Failed to read Lean target: ${targetFile.path}`);
    }

    const sourceText = source.content;

    sourceRisks.push(...scanRiskyLeanSource(targetFile.path, sourceText));

    const check = await runSandboxCommand(
      params.sandbox,
      `cd ${quoteForShell(params.repositoryRoot)} && lake env lean ${quoteForShell(targetFile.path)}`,
      { abortSignal: params.abortSignal },
    );
    const output = [check.stdout, check.stderr].filter(Boolean).join("\n");

    diagnostics.push(...parseLeanDiagnostics(output, params.repositoryRoot));
    evidence.push({
      kind: "compiler",
      status: check.success ? "passed" : "failed",
      summary: check.success
        ? `Lean accepted ${targetFile.path}.`
        : `Lean rejected ${targetFile.path}: ${output.slice(0, 3000) || `exit ${check.exitCode}`}`,
      path: targetFile.path,
      declaration: null,
    });
  }

  if (evidence.some((entry) => entry.kind === "compiler" && entry.status === "failed")) {
    return { outcome: "incomplete", diagnostics, evidence, sourceRisks };
  }

  for (const risk of sourceRisks) {
    evidence.push({
      kind: "source_policy",
      status: "warning",
      summary: risk.summary,
      path: risk.path,
      declaration: null,
    });
  }

  if (params.declarations.length === 0 || sourceRisks.length > 0) {
    return { outcome: "compiled", diagnostics, evidence, sourceRisks };
  }

  const auditPath = `/tmp/polychat-lean-axioms-${crypto.randomUUID()}.lean`;
  const auditSource = [
    ...params.targetPaths.map((path) => `import ${toModuleName(path)}`),
    "",
    ...params.declarations.map((declaration) => `#print axioms ${declaration}`),
    "",
  ].join("\n");

  await params.sandbox.writeFile(auditPath, auditSource);

  try {
    const audit = await runSandboxCommand(
      params.sandbox,
      `cd ${quoteForShell(params.repositoryRoot)} && lake env lean ${quoteForShell(auditPath)}`,
      { abortSignal: params.abortSignal },
    );
    const output = [audit.stdout, audit.stderr].filter(Boolean).join("\n");
    const parsed = parseAxiomAudit(output);

    if (!audit.success || !parsed.passed) {
      const summaries = parsed.summaries.length > 0 ? parsed.summaries : [output.slice(0, 3000)];

      for (const summary of summaries) {
        evidence.push({
          kind: "kernel",
          status: "warning",
          summary: summary || "Lean axiom audit failed.",
          path: null,
          declaration: null,
        });
      }

      return { outcome: "compiled", diagnostics, evidence, sourceRisks };
    }

    evidence.push({
      kind: "kernel",
      status: "passed",
      summary: "Lean accepted every requested declaration without unexpected axioms.",
      path: null,
      declaration: null,
    });

    return { outcome: "kernel_checked", diagnostics, evidence, sourceRisks };
  } finally {
    await params.sandbox.exec(`rm -f -- ${quoteForShell(auditPath)}`);
  }
}
