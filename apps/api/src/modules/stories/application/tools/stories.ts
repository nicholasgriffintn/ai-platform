import { findRelatedStoriesInputSchema, readStoryInputSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import type z from "zod/v4";

import { describeRelatedStory, renderStoryForModel } from "~/modules/stories/domain/render";
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
