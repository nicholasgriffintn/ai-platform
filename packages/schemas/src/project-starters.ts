import z from "zod/v4";

export interface ProjectStarterTeammate {
  roleSlug: string;
  name: string;
}

export interface ProjectStarter {
  slug: string;
  name: string;
  description: string;
  when: string;
  instructions: string;
  teammates: readonly ProjectStarterTeammate[];
  apps: readonly string[];
  tools: readonly string[];
}

export const PROJECT_STARTERS: readonly ProjectStarter[] = [
  {
    slug: "build-an-internal-tool",
    name: "Build an internal tool",
    description:
      "A project set up to take a small internal tool from a sentence to something the team can open.",
    when: "Somebody keeps doing a fiddly thing by hand and it would be quicker to build them a page.",
    instructions:
      "This project builds small internal tools: the rota page, the reconciliation script, the form that saves somebody an afternoon.\n\nStart every tool by naming who uses it and the one thing they need to do with it. Build the smallest version that does that thing, run it, and leave the working result in the project's files rather than pasting code into the conversation. Write down what the tool assumes and what it will not do, so the next person does not have to guess.\n\nPrefer boring, readable implementations. A tool nobody can change is a tool nobody keeps.",
    teammates: [{ roleSlug: "developer", name: "Developer" }],
    apps: [],
    tools: [
      "run_sandbox_task",
      "get_task_status",
      "v0_code_generation",
      "write_document",
      "search_documents",
    ],
  },
];

export function findProjectStarter(slug: string | null | undefined): ProjectStarter | undefined {
  return PROJECT_STARTERS.find((starter) => starter.slug === slug);
}

export const projectStarterSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  when: z.string(),
  teammates: z.array(z.object({ roleSlug: z.string(), name: z.string(), title: z.string() })),
  apps: z.array(z.string()),
  tools: z.array(z.string()),
});

export const projectStarterListResponseSchema = z.object({
  starters: z.array(projectStarterSummarySchema),
});

export const instantiateProjectStarterSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2).max(100).optional(),
});

export type ProjectStarterSummary = z.infer<typeof projectStarterSummarySchema>;
export type InstantiateProjectStarterInput = z.infer<typeof instantiateProjectStarterSchema>;
