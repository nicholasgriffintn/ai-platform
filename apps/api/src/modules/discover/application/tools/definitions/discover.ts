import {
  type ComposeDiscoverEditionInput,
  type CreateDiscoverWindDown,
  composeDiscoverEditionInputSchema,
  createDiscoverWindDownSchema,
  WIND_DOWN_TOOL_NAME,
  DISCOVER_COMPOSE_TOOL_NAME,
  DISCOVER_CONTEXT_TOOL_NAME,
  readDiscoverContextInputSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "~/types/functions";

export const read_discover_context: FunctionToolDescriptor = {
  name: DISCOVER_CONTEXT_TOOL_NAME,
  description:
    "Read what today's Discover edition should be built from: the date, what the person asked for, their feedback on earlier editions, recent chat titles, what Poly remembers, what is waiting on them and what recent editions already showed. Use it before writing an edition.",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  inputSchema: readDiscoverContextInputSchema,
};

export const prepare_wind_down: FunctionToolDescriptor = {
  name: WIND_DOWN_TOOL_NAME,
  description:
    "Prepare a wind-down session for the person in Discover: breathing, body scan, unwind (about their day), a slow story (story, with an optional topic and premise), their highlights read back (read_back), park (what is on their mind, set aside for the morning, from notes) or just the sound; five, ten, twenty or thirty minutes. It starts recording straight away and is ready to play within a minute.",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "draft" },
  intentEvidence: (input: CreateDiscoverWindDown) => ({
    operation: WIND_DOWN_TOOL_NAME,
    destination: "the person's own Discover wind down",
    kind: input.kind,
    minutes: input.minutes,
  }),
  inputSchema: createDiscoverWindDownSchema,
};

export const compose_discover_edition: FunctionToolDescriptor = {
  name: DISCOVER_COMPOSE_TOOL_NAME,
  description:
    "Save today's Discover edition for the person, replacing any earlier edition from today. Only use it when writing their Discover edition or when they ask you to change it. Cards on hidden topics and links shown in recent editions are dropped.",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "draft" },
  intentEvidence: (input: ComposeDiscoverEditionInput) => ({
    operation: DISCOVER_COMPOSE_TOOL_NAME,
    destination: "the person's own Discover edition",
    interests: input.interests.map((interest) => interest.topic),
    cards: input.cards.map((card) => card.kind),
  }),
  inputSchema: composeDiscoverEditionInputSchema,
};
