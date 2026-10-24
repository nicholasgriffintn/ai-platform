import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { IEnv, IUser } from "~/types";

import { researchOptionsFor } from "./options";
import { handleResearchTask } from "./task";
import type { ResearchDepth } from "./tools/definitions/research";

export interface ResearchCitation {
  title: string;
  url: string;
}

export interface ResearchReport {
  markdown: string;
  citations: ResearchCitation[];
}

const citationSchema = z.object({
  title: z.string().nullish(),
  url: z.string().nullish(),
});

const parallelOutputSchema = z.object({
  content: z.unknown(),
  basis: z.array(z.object({ citations: z.array(citationSchema).optional() })).optional(),
});

const exaOutputSchema = z.object({
  markdown: z.string().optional(),
  content: z.unknown().optional(),
  citations: z.array(citationSchema).optional(),
});

function readCitations(citations: z.infer<typeof citationSchema>[]): ResearchCitation[] {
  const byUrl = new Map<string, ResearchCitation>();

  for (const citation of citations) {
    if (!citation.url || !URL.canParse(citation.url) || byUrl.has(citation.url)) {
      continue;
    }

    byUrl.set(citation.url, { title: citation.title?.trim() || citation.url, url: citation.url });
  }

  return [...byUrl.values()];
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value ?? "", null, 2);
}

export function readResearchReport(provider: string, output: unknown): ResearchReport {
  if (provider === "exa") {
    const parsed = exaOutputSchema.safeParse(output);

    if (parsed.success) {
      return {
        markdown: parsed.data.markdown ?? readText(parsed.data.content),
        citations: readCitations(parsed.data.citations ?? []),
      };
    }
  }

  const parsed = parallelOutputSchema.safeParse(output);

  if (!parsed.success) {
    throw new AssistantError("The research returned nothing readable", ErrorType.PROVIDER_ERROR);
  }

  return {
    markdown: readText(parsed.data.content),
    citations: readCitations((parsed.data.basis ?? []).flatMap((basis) => basis.citations ?? [])),
  };
}

export async function runResearchReport(params: {
  env: IEnv;
  user: IUser;
  query: string;
  depth: ResearchDepth;
}): Promise<ResearchReport> {
  const response = await handleResearchTask({
    env: params.env,
    user: params.user,
    input: params.query,
    provider: "parallel",
    options: researchOptionsFor({ depth: params.depth, format: "report", provider: "parallel" }),
  });
  const data = z.object({ provider: z.string(), output: z.unknown() }).parse(response.data);

  return readResearchReport(data.provider, data.output);
}
