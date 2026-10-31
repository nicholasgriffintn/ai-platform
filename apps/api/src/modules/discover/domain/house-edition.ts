import {
  DISCOVER_EDITION_VERSION,
  DISCOVER_HOUSE_COVER_PREFIX,
  type DiscoverBriefLine,
  type DiscoverCard,
  type DiscoverEdition,
} from "@ngriffin_uk/polychat-schemas";

export const HOUSE_EDITION_ID_PREFIX = "house";
const HOUSE_TOPIC = "Polychat";

const START_LINES: readonly DiscoverBriefLine[] = [
  {
    kind: "note",
    label: "Start here",
    text: "Ask anything in the composer below. Every model answers from one place.",
    href: "/chat",
  },
  {
    kind: "note",
    label: "Tour",
    text: "Five minutes on what Polychat is for.",
    href: "/tour",
  },
];

const STARTER_CARDS: readonly DiscoverCard[] = [
  {
    kind: "topic",
    id: "start-models",
    coverId: `${DISCOVER_HOUSE_COVER_PREFIX}models`,
    topic: HOUSE_TOPIC,
    title: "Every model in one picker",
    angle:
      "Ask once and choose who answers: the frontier models, the open ones, and whichever you bring your own keys for. Change your mind mid-conversation and the thread carries on.",
    prompt: "Which models can I use here, and how do I pick one for a conversation?",
    reason: "The first thing most people want to know.",
    sensitive: false,
  },
  {
    kind: "topic",
    id: "start-teammates",
    coverId: `${DISCOVER_HOUSE_COVER_PREFIX}teammates`,
    topic: HOUSE_TOPIC,
    title: "Teammates that take the work",
    angle:
      "A teammate is a colleague with a brief, tools and a budget. Hand it a task and it reports back, asking before it sends, spends or deletes anything.",
    prompt: "What can a teammate do for me, and how do I set one up?",
    reason: "Where Polychat stops being a chat box.",
    sensitive: false,
  },
  {
    kind: "topic",
    id: "start-notebooks",
    coverId: `${DISCOVER_HOUSE_COVER_PREFIX}notebooks`,
    topic: HOUSE_TOPIC,
    title: "A notebook for what you keep",
    angle:
      "Notebooks gather sources, notes and the conversations about them in one place, with guides, audio and video overviews drawn from what is inside.",
    prompt:
      "Make me a notebook called Getting started with Polychat and fill it with what I should know first.",
    reason: "Your first notebook is one message away.",
    sensitive: false,
  },
  {
    kind: "topic",
    id: "start-discover",
    coverId: `${DISCOVER_HOUSE_COVER_PREFIX}discover`,
    topic: HOUSE_TOPIC,
    title: "A morning edition, written for you",
    angle:
      "Turn on Discover and Poly reads what you have been talking about, then leaves an edition here each morning: a brief, topics worth a look, links and a round-up to listen to.",
    prompt: "What does Discover do each morning, and what does it read to write my edition?",
    reason: "This page, once it knows you.",
    sensitive: false,
  },
  {
    kind: "action",
    id: "start-routine",
    title: "Set up a weekly reading suggestion",
    detail:
      "A built-in routine that picks something worth reading each Sunday from what you have been talking about. It needs nothing connected.",
    when: "Sundays 09:00",
    prompt:
      "Set up the weekly reading suggestion routine for me. Show me what it will do and ask before you install it.",
    reason: "A routine that runs without connecting anything.",
    sensitive: false,
  },
];

export function houseEditionId(date: string): string {
  return `${HOUSE_EDITION_ID_PREFIX}-${date}`;
}

export function buildHouseEdition(params: { date: string; now: Date }): DiscoverEdition {
  return {
    id: houseEditionId(params.date),
    revision: 0,
    version: DISCOVER_EDITION_VERSION,
    date: params.date,
    timezone: "UTC",
    greeting: "Welcome to Polychat",
    interests: [],
    brief: [...START_LINES],
    cards: [...STARTER_CARDS],
    edition: "morning",
    generatedAt: params.now.toISOString(),
    feedback: {},
  };
}
