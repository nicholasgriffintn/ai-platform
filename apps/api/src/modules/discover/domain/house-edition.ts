import {
  DISCOVER_EDITION_VERSION,
  DISCOVER_HOUSE_COVER_PREFIX,
  type DiscoverBriefLine,
  type DiscoverCard,
  type DiscoverEdition,
} from "@ngriffin_uk/polychat-schemas";

export const HOUSE_EDITION_ID_PREFIX = "house";

const START_LINES: readonly DiscoverBriefLine[] = [
  {
    kind: "note",
    label: "Your keys",
    text: "Bring the provider keys you already pay for. Usage on them costs no credits.",
    href: "/profile?tab=providers",
  },
  {
    kind: "note",
    label: "Pro",
    text: "Hosted models, voice, Work and apps, drawn from a monthly pot of credits.",
    href: "/pricing",
  },
  {
    kind: "note",
    label: "Tour",
    text: "Five minutes on what Polychat is for, from models to teammates.",
    href: "/tour",
  },
];

const STARTER_CARDS: readonly DiscoverCard[] = [
  {
    kind: "topic",
    id: "start-models",
    coverId: `${DISCOVER_HOUSE_COVER_PREFIX}models`,
    topic: "Models",
    title: "Every model in one picker",
    angle:
      "Ask once and choose who answers: the frontier models, the open ones, and whichever you bring your own keys for. Change your mind mid-conversation and the thread carries on.",
    prompt: "Which models can I use here, and how do I pick one for a conversation?",
    reason: "The first thing most people want to know.",
    sensitive: false,
  },
  {
    kind: "topic",
    id: "start-council",
    coverId: `${DISCOVER_HOUSE_COVER_PREFIX}council`,
    topic: "Council",
    title: "Let a council argue it out",
    angle:
      "Put one question to several models at once and let them review each other. You read where they agree, where they part ways and why.",
    prompt:
      "How does a council work here, and when is it worth asking several models instead of one?",
    reason: "For when one answer is not enough.",
    sensitive: false,
  },
  {
    kind: "topic",
    id: "start-teammates",
    coverId: `${DISCOVER_HOUSE_COVER_PREFIX}teammates`,
    topic: "Teammates",
    title: "Teammates that take the work",
    angle:
      "A teammate is a colleague with a brief, tools and a budget. Hand it a task and it reports back, asking before it sends, spends or deletes anything.",
    prompt: "What can a teammate do for me, and how do I set one up?",
    reason: "Where Polychat stops being a chat box.",
    sensitive: false,
  },
  {
    kind: "topic",
    id: "start-work",
    coverId: `${DISCOVER_HOUSE_COVER_PREFIX}work`,
    topic: "Work",
    title: "Work, for projects with people in them",
    angle:
      "When a question grows into a project, open Work: shared workspaces, projects and tasks, with teammates to run them and usage beside the work.",
    prompt:
      "What is the difference between Chat and Work, and when should I move something into Work?",
    reason: "Where a chat grows into a project.",
    sensitive: false,
  },
  {
    kind: "topic",
    id: "start-notebooks",
    coverId: `${DISCOVER_HOUSE_COVER_PREFIX}notebooks`,
    topic: "Notebooks",
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
    id: "start-sites",
    coverId: `${DISCOVER_HOUSE_COVER_PREFIX}sites`,
    topic: "Sites",
    title: "A site from one description",
    angle:
      "Describe a website, an app screen or a component and watch it appear as it is written. Keep editing it in conversation until it is right.",
    prompt: "What kinds of things can Sites build, and what makes a good brief for one?",
    reason: "The quickest way to see something made.",
    sensitive: false,
  },
  {
    kind: "topic",
    id: "start-discover",
    coverId: `${DISCOVER_HOUSE_COVER_PREFIX}discover`,
    topic: "Discover",
    title: "A morning edition, written for you",
    angle:
      "Turn on Discover and Poly reads what you have been talking about, then leaves an edition here each morning: a brief, topics worth a look, links and a round-up to listen to.",
    prompt: "What does Discover do each morning, and what does it read to write my edition?",
    reason: "This page, once it knows you.",
    sensitive: false,
  },
  {
    kind: "topic",
    id: "start-pets",
    coverId: `${DISCOVER_HOUSE_COVER_PREFIX}pets`,
    topic: "Pets",
    title: "Meet the flock",
    angle:
      "A pet perches above the composer and reacts to whatever Polychat is doing. Four parrots that used to be logos, and a few strays that turned up on their own.",
    prompt: "Which pets can I choose from, and how do I change mine?",
    reason: "Company while you work.",
    sensitive: false,
  },
  {
    kind: "action",
    id: "start-intro",
    title: "Tell Poly what you are working on",
    detail:
      "Answer a couple of quick questions and Poly suggests three things worth trying here this week.",
    prompt:
      "I'm new to Polychat. Ask me two or three short questions about what I work on and what I'd like a hand with, one at a time. Then suggest three specific things I could try here this week.",
    reason: "So your first chat starts somewhere useful.",
    sensitive: false,
  },
  {
    kind: "action",
    id: "start-keys",
    title: "Bring your own provider keys",
    detail:
      "Add keys for the providers you already pay for and chat with their models here. Usage on your own keys costs no credits.",
    prompt: "Walk me through adding my own provider keys and which models each one unlocks.",
    reason: "Free accounts chat on their own keys.",
    sensitive: false,
  },
  {
    kind: "action",
    id: "start-compare",
    title: "Ask three models the same question",
    detail:
      "One prompt, three answers side by side. The quickest way to find out which model suits how you think.",
    prompt:
      "Ask three different models what the most underrated habit for clear thinking is, then compare their answers side by side.",
    reason: "A first chat that shows what is different here.",
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
