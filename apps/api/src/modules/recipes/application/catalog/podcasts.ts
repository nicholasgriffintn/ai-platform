import type { CatalogRecipe } from "./shared";
import { WEB_SEARCH_TOOL } from "./shared";

export const PODCAST_TOOL = "generate_podcast";

export const podcastRecipes: CatalogRecipe[] = [
  {
    id: "podcast-briefing",
    title: "Podcast Briefing",
    summary:
      "Turn your sources or the latest on your topics into a two-host episode on a schedule.",
    description:
      "Researches the topics you choose, or uses the Sources you name, and generates a podcast episode with a transcript, show notes and cover art. Episodes land in Sources and in a show with a private RSS feed for your podcast app.",
    kind: "automate",
    category: "Productivity",
    featured: true,
    enabledTools: [PODCAST_TOOL, "search_documents", WEB_SEARCH_TOOL],
    integrations: [],
    triggers: [
      {
        type: "schedule",
        label: "Scheduled episode",
        description: "Generate a new episode on your schedule, such as every weekday morning.",
      },
      {
        type: "message",
        label: "Make an episode now",
        description: "Ask for an episode about something specific.",
      },
    ],
    actions: [
      "Research the configured topics or search your Sources",
      "Write and voice a two-host episode grounded in what it found",
      "Publish the episode to the show's RSS feed",
    ],
    invocationContext: {
      instructions:
        "Make one podcast episode. When topics are configured, search the web for the latest on them and pass the findings, with their links, as material. When source search terms are configured, find matching passages with search_documents and pass those source ids. Call generate_podcast once with the configured show, format, length and focus. Never invent findings; skip a topic with nothing new rather than padding.",
    },
    setupPrompt:
      "Set up Podcast Briefing. Ask which show to publish to, what each episode should cover (web topics, my own Sources, or both), the format (deep dive, brief, debate or critique), the length and any focus or audience. Save it with configure_recipe and offer a schedule. Explain that episodes take a few minutes, land in Sources and appear in the show's private RSS feed, which I can copy from the Podcasts view in Files.",
    configurationFields: [
      {
        key: "show",
        label: "Show",
        type: "text",
        required: true,
        maximum: 120,
        placeholder: "Morning briefing",
        description: "Episodes are published to this show. It is created the first time.",
      },
      {
        key: "topics",
        label: "Web topics",
        type: "string_list",
        placeholder: "AI agents, climate policy, Premier League",
      },
      {
        key: "sourceQuery",
        label: "Search my Sources for",
        type: "text",
        maximum: 200,
        placeholder: "Meeting notes from this week",
      },
      {
        key: "format",
        label: "Format",
        type: "text",
        defaultValue: "deep_dive",
        pattern: "^(deep_dive|brief|debate|critique)$",
        description: "deep_dive, brief, debate or critique.",
      },
      {
        key: "length",
        label: "Length",
        type: "text",
        defaultValue: "default",
        pattern: "^(short|default|long)$",
        description: "short, default or long.",
      },
      {
        key: "focus",
        label: "Focus",
        type: "textarea",
        placeholder: "Who the listener is and what the hosts should concentrate on",
      },
    ],
  },
];
