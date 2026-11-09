import {
  compareCoverageInputSchema,
  findRelatedStoriesInputSchema,
  followEntityInputSchema,
  readStoryInputSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import type z from "zod/v4";

import { followDiscoverTopic } from "~/modules/discover/application/follows";
import {
  describeRelatedStory,
  renderCoverageComparison,
  renderStoryForModel,
} from "~/modules/stories/domain/render";
import { EntityRepository } from "~/modules/stories/infrastructure/EntityRepository";
import type { ApiToolDefinition, ApiToolExecutionContext } from "~/types/functions";

import { findRelatedStories, readStoryPage } from "../read-models";

function requireSignedIn({ request }: ApiToolExecutionContext) {
  if (!request.context || !request.user?.id) {
    throw new AssistantError("Sign in to read stories", ErrorType.AUTHENTICATION_ERROR, 401);
  }

  return request.context;
}

export const read_story: ApiToolDefinition = {
  name: "read_story",
  capabilityHint: "read a Discover news story",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "Read a shared Discover story by id: its overview, what outlets agree and differ on, each outlet's angle, verified quotes, the people and organisations involved, earlier stories it continues and its articles. Story ids appear on Discover cards and in find_related_stories results.",
  inputSchema: readStoryInputSchema,
  execute: async (args: z.infer<typeof readStoryInputSchema>, toolContext) => {
    const context = requireSignedIn(toolContext);
    const page = await readStoryPage(context.env, args.storyId);

    return {
      name: "read_story",
      status: "success",
      content: renderStoryForModel(page),
      data: { story: page.story, responseType: "text" },
    };
  },
};

export const find_related_stories: ApiToolDefinition = {
  name: "find_related_stories",
  capabilityHint: "find earlier news stories on a subject",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "Find Discover stories connected to a story, or stories about an event or subject described in words, reaching back in time. Returns story ids to pass to read_story.",
  inputSchema: findRelatedStoriesInputSchema,
  execute: async (args: z.infer<typeof findRelatedStoriesInputSchema>, toolContext) => {
    const context = requireSignedIn(toolContext);
    const stories = await findRelatedStories(context.env, args);

    return {
      name: "find_related_stories",
      status: "success",
      content:
        stories.length > 0
          ? stories.map((story) => `- ${describeRelatedStory(story)}`).join("\n")
          : "No related stories found.",
      data: { stories, responseType: "text" },
    };
  },
};

export const compare_coverage: ApiToolDefinition = {
  name: "compare_coverage",
  capabilityHint: "compare how outlets cover a news story",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "Compare how outlets cover a Discover story: who broke it, how many articles each outlet ran and when, each outlet's angle, and what they agree on, dispute or leave out.",
  inputSchema: compareCoverageInputSchema,
  execute: async (args: z.infer<typeof compareCoverageInputSchema>, toolContext) => {
    const context = requireSignedIn(toolContext);
    const page = await readStoryPage(context.env, args.storyId);

    return {
      name: "compare_coverage",
      status: "success",
      content: renderCoverageComparison(page),
      data: { story: page.story, coverage: page.coverage, responseType: "text" },
    };
  },
};

export const follow_entity: ApiToolDefinition = {
  name: "follow_entity",
  capabilityHint: "follow a person or organisation in the news",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  intentEvidence: () => ({
    operation: "follow_entity",
    destination: "the person's Discover follows",
  }),
  description:
    "Follow a person, organisation, place or product from a Discover story so new coverage of them reaches the person's Discover. Entity ids appear in read_story results.",
  inputSchema: followEntityInputSchema,
  execute: async (args: z.infer<typeof followEntityInputSchema>, toolContext) => {
    const context = requireSignedIn(toolContext);
    const entity = await new EntityRepository(context.env).get(args.entityId);

    if (!entity) {
      throw new AssistantError("Entity not found", ErrorType.NOT_FOUND, 404);
    }

    const follow = await followDiscoverTopic(context, entity.name);

    return {
      name: "follow_entity",
      status: "success",
      content: `Following ${entity.name} in Discover.`,
      data: { follow, responseType: "text" },
    };
  },
};
