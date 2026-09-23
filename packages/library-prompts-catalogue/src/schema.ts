import { z } from "zod";

export const promptTasks = [
  "chat-system",
  "chat-section",
  "chat-goal",
  "meta-assistant",
  "sandbox-controller",
  "sandbox-agent",
  "sandbox-strategy",
  "memory-classifier",
  "memory-normaliser",
  "memory-summariser",
  "memory-synthesis",
  "conversation-summary",
  "conversation-title",
  "document-metadata",
  "document-format",
  "document-notes",
  "content-extraction",
  "article-analysis",
  "article-summary",
  "article-report",
  "image-description",
  "drawing-guess",
  "image-style",
  "web-search-questions",
  "web-search-answer",
  "strudel",
  "site-generate",
  "site-refine",
  "hacker-news",
  "pet-image",
  "agent-runner",
  "agent-guidelines",
  "text-list",
  "text-extract",
  "text-classify",
  "text-score",
  "text-summarise",
  "text-verdict",
  "structured-output",
  "panel-turn",
  "council",
  "second-opinion",
  "teammate-persona",
  "team-role",
  "project-planning",
  "task-runner",
  "quality-scoring",
  "recipe-runtime",
  "guardrails",
  "control-notice",
] as const;

export type PromptTask = (typeof promptTasks)[number];

export const PROMPT_VARIABLE_PATTERN = /\{\{\s*[#^]?\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export const promptTaskSchema = z.enum(promptTasks);

export const promptVariableSchema = z
  .object({
    name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
    description: z.string().min(1),
    example: z.string().min(1).optional(),
    default: z.string().optional(),
  })
  .strict();

export const promptEntrySchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/, "Prompt ids are lowercase path-like segments"),
    task: promptTaskSchema,
    variant: z.string().min(1).optional(),
    title: z.string().min(1),
    description: z.string().min(1),
    text: z.string().min(1),
    variables: z.array(promptVariableSchema).optional(),
  })
  .strict();

export type PromptVariable = z.infer<typeof promptVariableSchema>;

export interface PromptEntry {
  readonly id: string;
  readonly task: PromptTask;
  readonly variant?: string;
  readonly title: string;
  readonly description: string;
  readonly text: string;
  readonly variables?: readonly PromptVariable[];
}

export function extractPromptVariables(text: string): string[] {
  const names = new Set<string>();

  for (const match of text.matchAll(PROMPT_VARIABLE_PATTERN)) {
    names.add(match[1]);
  }

  return [...names].sort();
}

export function validatePromptEntry(entry: PromptEntry): string[] {
  const referenced = extractPromptVariables(entry.text);
  const declared = (entry.variables ?? []).map((variable) => variable.name);
  const problems: string[] = [];
  const result = promptEntrySchema.safeParse(entry);

  if (!result.success) {
    for (const issue of result.error.issues) {
      problems.push(`${issue.path.join(".") || "entry"}: ${issue.message}`);
    }
  }

  for (const name of referenced) {
    if (!declared.includes(name)) {
      problems.push(`references undeclared variable "{{${name}}}"`);
    }
  }

  for (const name of declared) {
    if (!referenced.includes(name)) {
      problems.push(`declares unused variable "${name}"`);
    }
  }

  return problems;
}
