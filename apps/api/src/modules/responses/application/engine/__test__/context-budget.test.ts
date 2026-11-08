import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildSkillsSection, buildStandardChatPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { formatToolCalls } from "@ngriffin_uk/polychat-ai-providers";
import { getBuiltInSkillCatalogue } from "@ngriffin_uk/polychat-library-skills-catalogue";
import {
  CURRENT_TIME_TOOL_NAME,
  SKILL_LOAD_TOOL_NAME,
  USER_INFORMATION_TOOL_NAME,
} from "@ngriffin_uk/polychat-schemas";
import {
  getUtf8ByteLength,
  trimTemplateWhitespace,
} from "@ngriffin_uk/polychat-utility-server/strings";
import { describe, expect, it } from "vitest";

import "~/tools";
import { APP_DESCRIPTION, APP_NAME } from "~/config/app";
import { getFunctionToolDescriptors } from "~/modules/tools/application/catalogue";

type BudgetName = "toolDeclarations" | "chatPrompt" | "agentPrompt" | "skillsBlock";
type Budget = Record<BudgetName, number>;

const BASELINE_PATH = path.join(import.meta.dirname, "context-budget.json");
const MEANINGFUL_DROP = 0.02;
const UPDATE_COMMAND =
  "UPDATE_CONTEXT_BUDGET=1 pnpm --filter @assistant/api exec vitest run context-budget";

function buildPrompt(mode: string): string {
  return trimTemplateWhitespace(
    buildStandardChatPrompt({
      assistantName: APP_NAME,
      assistantDescription: APP_DESCRIPTION,
      model: { modelId: "context-budget" },
      mode,
      supportsToolCalls: true,
      userContext: {},
      skillLoadTool: SKILL_LOAD_TOOL_NAME,
      currentTimeTool: CURRENT_TIME_TOOL_NAME,
      userInformationTool: USER_INFORMATION_TOOL_NAME,
    }),
  );
}

const declarations = formatToolCalls("anthropic", getFunctionToolDescriptors());
const skills = getBuiltInSkillCatalogue()
  .listDefinitions()
  .map((skill) => ({ id: skill.id, description: skill.description }));
const measured: Budget = {
  toolDeclarations: getUtf8ByteLength(JSON.stringify(declarations)),
  chatPrompt: getUtf8ByteLength(buildPrompt("standard")),
  agentPrompt: getUtf8ByteLength(buildPrompt("agent")),
  skillsBlock: getUtf8ByteLength(
    buildSkillsSection(skills, { skillLoadTool: SKILL_LOAD_TOOL_NAME }),
  ),
};

if (process.env.UPDATE_CONTEXT_BUDGET) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(measured, null, 2)}\n`);
}

const baseline: Budget = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));

function largestDeclarations(): string {
  return declarations
    .map((declaration) => ({
      name: "name" in declaration ? declaration.name : "",
      bytes: getUtf8ByteLength(JSON.stringify(declaration)),
    }))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, 5)
    .map(({ name, bytes }) => `${name} (${bytes} B)`)
    .join(", ");
}

function budgetMessage(name: BudgetName): string {
  const actual = measured[name];
  const allowed = baseline[name];
  const hint = name === "toolDeclarations" ? ` Largest: ${largestDeclarations()}.` : "";

  if (actual > allowed) {
    return `${name} grew from ${allowed} to ${actual} bytes (+${actual - allowed}). This text is sent with every request, so trim descriptions or schemas first.${hint} If the growth is deliberate, run \`${UPDATE_COMMAND}\` and commit context-budget.json with a reason in the PR.`;
  }

  return `${name} shrank from ${allowed} to ${actual} bytes (-${allowed - actual}). Lock the gain in: run \`${UPDATE_COMMAND}\` and commit context-budget.json.`;
}

describe("model context budget", () => {
  it.each(Object.keys(measured) as BudgetName[])("keeps %s within its baseline", (name) => {
    const actual = measured[name];
    const allowed = baseline[name];

    expect(actual <= allowed, budgetMessage(name)).toBe(true);
    expect(actual >= allowed * (1 - MEANINGFUL_DROP), budgetMessage(name)).toBe(true);
  });
});
