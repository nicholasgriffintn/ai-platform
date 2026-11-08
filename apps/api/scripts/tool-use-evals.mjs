#!/usr/bin/env node
import { mkdir, readdir, readFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  findToolUseRegressions,
  gradeToolUse,
  resolveToolUseCaseVerdict,
} from "@ngriffin_uk/polychat-library-model-registry/tool-use";
import { toolUseEvalCaseSchema } from "@ngriffin_uk/polychat-schemas";

const EVALS_DIR = path.resolve(import.meta.dirname, "../evals/tool-use");
const CASES_DIR = path.join(EVALS_DIR, "cases");
const RESULTS_DIR = path.join(EVALS_DIR, "results");
const DEFAULT_API_URL = "http://localhost:8787";

const USAGE = `Usage:
  tool-use-evals.mjs run --model <id> [--provider <id>] [--case <id,...>] [--samples 2]
                         [--max-steps 8] [--concurrency 3] [--baseline <results.jsonl>]
                         [--stop-on-regression] [--out <results.jsonl>]
  tool-use-evals.mjs regrade <results.jsonl> [--baseline <results.jsonl>]

Samples run against POLYCHAT_API_URL (default ${DEFAULT_API_URL}) with POLYCHAT_API_KEY
from \`polychat token\`. Each case is sampled twice and a third time when the two disagree.`;

async function loadCases() {
  const files = (await readdir(CASES_DIR)).filter((file) => file.endsWith(".ndjson")).sort();
  const cases = [];

  for (const file of files) {
    const lines = (await readFile(path.join(CASES_DIR, file), "utf8")).split("\n");

    lines.forEach((line, index) => {
      if (!line.trim()) {
        return;
      }

      const parsed = toolUseEvalCaseSchema.safeParse(JSON.parse(line));

      if (!parsed.success) {
        throw new Error(`${file}:${index + 1} is not a valid case: ${parsed.error.message}`);
      }

      cases.push(parsed.data);
    });
  }

  const ids = new Set(cases.map((item) => item.id));

  if (ids.size !== cases.length) {
    throw new Error("Case ids must be unique across case files");
  }

  return cases;
}

async function readRecords(file) {
  return (await readFile(file, "utf8"))
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function gradeRecord(record, evalCase) {
  if (!record.sample) {
    return { passed: false, failures: [{ check: "error", detail: record.error }] };
  }

  return gradeToolUse(evalCase.expect, record.sample.trajectory);
}

function summarise(records, casesById) {
  const byCase = new Map();

  for (const record of records) {
    const evalCase = casesById.get(record.caseId) ?? record.case;
    const grade = gradeRecord(record, evalCase);
    const entry = byCase.get(record.caseId) ?? { kind: evalCase.kind, grades: [], costUsd: 0 };

    entry.grades.push(grade);
    entry.costUsd += record.sample?.costUsd ?? 0;
    byCase.set(record.caseId, entry);
  }

  return new Map(
    [...byCase].map(([caseId, entry]) => [
      caseId,
      {
        ...entry,
        verdict: resolveToolUseCaseVerdict(entry.grades.map((grade) => grade.passed)),
      },
    ]),
  );
}

function verdictMap(summary) {
  return new Map([...summary].map(([caseId, entry]) => [caseId, entry.verdict.passed]));
}

function report(summary, baseline) {
  let cost = 0;

  for (const [caseId, entry] of summary) {
    const failures = entry.grades
      .flatMap((grade) => grade.failures)
      .map((failure) => `${failure.check}: ${failure.detail}`);

    cost += entry.costUsd;
    console.log(
      `${entry.verdict.passed ? "PASS" : "FAIL"}  ${caseId} [${entry.kind}] ${entry.grades
        .map((grade) => (grade.passed ? "✓" : "✗"))
        .join("")}${failures.length ? `\n      ${[...new Set(failures)].join("\n      ")}` : ""}`,
    );
  }

  const passed = [...summary.values()].filter((entry) => entry.verdict.passed).length;

  console.log(`\n${passed}/${summary.size} cases passed, $${cost.toFixed(4)} sampled`);

  if (!baseline) {
    return [];
  }

  const regressions = findToolUseRegressions(verdictMap(summary), verdictMap(baseline));

  console.log(
    regressions.length
      ? `Regressed against baseline: ${regressions.join(", ")}`
      : "No regressions against baseline",
  );

  return regressions;
}

async function requestSample(evalCase, options) {
  const response = await fetch(`${options.apiUrl}/model_platform/tool-use-evals/samples`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      case: evalCase,
      model: options.model,
      provider: options.provider,
      maxSteps: options.maxSteps,
    }),
  });

  if (!response.ok) {
    return { error: `${response.status} ${await response.text()}` };
  }

  return { sample: await response.json() };
}

async function sampleCase(evalCase, options) {
  const records = [];

  const takeSample = async () => {
    const result = await requestSample(evalCase, options);
    const record = {
      caseId: evalCase.id,
      case: evalCase,
      model: options.model,
      provider: options.provider ?? null,
      sampledAt: new Date().toISOString(),
      ...result,
    };

    records.push(record);
    await appendFile(options.out, `${JSON.stringify(record)}\n`);

    return gradeRecord(record, evalCase).passed;
  };

  const passes = [];

  for (let index = 0; index < options.samples; index += 1) {
    passes.push(await takeSample());
  }

  if (resolveToolUseCaseVerdict(passes).needsTieBreak) {
    passes.push(await takeSample());
  }

  return records;
}

async function loadBaseline(file, casesById) {
  return file ? summarise(await readRecords(file), casesById) : null;
}

async function run(values) {
  if (!values.model) {
    throw new Error(USAGE);
  }

  const apiKey = process.env.POLYCHAT_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Set POLYCHAT_API_KEY, for example with: export POLYCHAT_API_KEY=$(polychat token)",
    );
  }

  const filter = values.case ? new Set(values.case.split(",").map((id) => id.trim())) : null;
  const allCases = await loadCases();
  const cases = filter ? allCases.filter((item) => filter.has(item.id)) : allCases;
  const casesById = new Map(allCases.map((item) => [item.id, item]));
  const baseline = await loadBaseline(values.baseline, casesById);
  const out =
    values.out ??
    path.join(
      RESULTS_DIR,
      `${new Date().toISOString().replace(/[:.]/g, "-")}-${values.model.replace(/[^\w.-]+/g, "_")}.jsonl`,
    );
  const options = {
    apiUrl: (process.env.POLYCHAT_API_URL ?? DEFAULT_API_URL).replace(/\/$/, ""),
    apiKey,
    model: values.model,
    provider: values.provider,
    samples: Number(values.samples),
    maxSteps: Number(values["max-steps"]),
    out,
  };
  const concurrency = Math.max(1, Number(values.concurrency));
  const queue = [...cases];
  const records = [];
  let stopped = false;

  await mkdir(path.dirname(out), { recursive: true });
  console.log(`Sampling ${cases.length} cases with ${values.model}; results in ${out}\n`);

  const worker = async () => {
    while (!stopped && queue.length > 0) {
      const evalCase = queue.shift();
      const caseRecords = await sampleCase(evalCase, options);

      records.push(...caseRecords);

      const passed = resolveToolUseCaseVerdict(
        caseRecords.map((record) => gradeRecord(record, evalCase).passed),
      ).passed;

      console.log(`${passed ? "pass" : "fail"}  ${evalCase.id}`);

      if (values["stop-on-regression"] && !passed && baseline?.get(evalCase.id)?.verdict.passed) {
        console.log(`Stopping: ${evalCase.id} passed in the baseline`);
        stopped = true;
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log("");

  return report(summarise(records, casesById), baseline);
}

async function regrade(file, values) {
  if (!file) {
    throw new Error(USAGE);
  }

  const casesById = new Map((await loadCases()).map((item) => [item.id, item]));

  return report(
    summarise(await readRecords(file), casesById),
    await loadBaseline(values.baseline, casesById),
  );
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: "string" },
    provider: { type: "string" },
    case: { type: "string" },
    samples: { type: "string", default: "2" },
    "max-steps": { type: "string", default: "8" },
    concurrency: { type: "string", default: "3" },
    baseline: { type: "string" },
    "stop-on-regression": { type: "boolean", default: false },
    out: { type: "string" },
    help: { type: "boolean", default: false },
  },
});

const [command, file] = positionals;

try {
  if (values.help || !command) {
    console.log(USAGE);
  } else if (command === "run") {
    process.exitCode = (await run(values)).length > 0 ? 1 : 0;
  } else if (command === "regrade") {
    process.exitCode = (await regrade(file, values)).length > 0 ? 1 : 0;
  } else {
    throw new Error(USAGE);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
