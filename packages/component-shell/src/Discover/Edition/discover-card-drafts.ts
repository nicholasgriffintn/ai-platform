import type { ChatSuggestion } from "@ngriffin_uk/polychat-library-react";
import type { DiscoverCard } from "@ngriffin_uk/polychat-schemas";

export function discoverCardEyebrow(card: DiscoverCard): string {
  switch (card.kind) {
    case "topic":
      return card.topic;
    case "read":
      return `${card.source} · ${card.topic}`;
    case "action":
      return card.when ? `Worth doing · ${card.when}` : "Worth doing";
    case "check_in":
      return "Checking in";
    case "resurface":
      return "From before";
  }
}

export function discoverCardHeadline(card: DiscoverCard): string {
  return card.kind === "check_in" ? card.question : card.title;
}

export function hasDiscoverTopic(card: DiscoverCard): boolean {
  return card.kind === "topic" || card.kind === "read";
}

export function cardTopic(card: DiscoverCard): string {
  return card.kind === "topic" || card.kind === "read" ? card.topic : "";
}

function suggestion(
  card: DiscoverCard,
  key: string,
  label: string,
  prompt: string,
): ChatSuggestion {
  return { id: `discover-${card.id}-${key}`, label, prompt, category: "discover" };
}

export function discoverCardSuggestions(card: DiscoverCard): ChatSuggestion[] {
  switch (card.kind) {
    case "topic":
      return [
        suggestion(card, "explore", card.title, card.prompt),
        suggestion(
          card,
          "explain",
          `Catch me up on ${card.topic}`,
          `Catch me up on ${card.topic}: what's happened recently and why it matters to me.`,
        ),
        suggestion(
          card,
          "follow",
          "Keep me posted on this",
          `Set up an automation that keeps me posted on ${card.topic} each week. Show me the schedule before you create it.`,
        ),
      ];
    case "read":
      return [
        suggestion(
          card,
          "gist",
          "Give me the gist",
          `Read ${card.url} and give me the gist in five bullet points.`,
        ),
        suggestion(
          card,
          "why",
          "Why does this matter to me?",
          `Read ${card.url}. Given what you know about me, why might it matter?`,
        ),
        suggestion(
          card,
          "counter",
          "What's the other side?",
          `Read ${card.url} and give me the strongest counterargument to it.`,
        ),
      ];
    case "action":
      return [
        suggestion(card, "start", card.title, card.prompt),
        suggestion(
          card,
          "explain",
          "Talk me through it first",
          `Before we do anything: ${card.detail} Talk me through the options.`,
        ),
      ];
    case "check_in":
      return [
        suggestion(card, "yes", "It went well", `${card.question} It went well.`),
        suggestion(
          card,
          "help",
          "Not yet, help me with it",
          `${card.question} Not yet. Help me with it.`,
        ),
      ];
    case "resurface":
      return [
        suggestion(
          card,
          "recap",
          "Remind me what this was",
          `Remind me what "${card.title}" was about and where I left it.`,
        ),
        suggestion(
          card,
          "next",
          "What should I do with it now?",
          `Looking again at "${card.title}": ${card.detail} What would be a useful next step?`,
        ),
      ];
  }
}
