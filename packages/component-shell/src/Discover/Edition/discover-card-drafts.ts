import type { ChatSuggestion } from "@ngriffin_uk/polychat-library-react";
import type { DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import { normaliseComparableText } from "@ngriffin_uk/polychat-utility-core";

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
    case "watch":
      return `Watch · ${card.source}`;
    case "listen":
      return `Listen · ${card.source}`;
    case "event":
      return card.where ? `${card.when} · ${card.where}` : card.when;
    case "inbox":
      return `From ${card.source}`;
    case "wind_down":
      return `Wind down · ${card.topic}`;
  }
}

export function discoverCardHeadline(card: DiscoverCard): string {
  return card.kind === "check_in" ? card.question : card.title;
}

export function discoverCardBody(card: DiscoverCard): string | null {
  switch (card.kind) {
    case "topic":
      return card.angle;
    case "read":
    case "watch":
    case "listen":
    case "inbox":
      return card.summary;
    case "event":
    case "action":
    case "resurface":
      return card.detail;
    case "wind_down":
      return card.premise;
    case "check_in":
      return null;
  }
}

export interface DiscoverCardLink {
  href: string;
  label: string;
}

export function discoverCardLink(card: DiscoverCard): DiscoverCardLink | null {
  switch (card.kind) {
    case "read":
      return { href: card.url, label: `Open on ${card.source}` };
    case "watch":
    case "listen":
    case "inbox":
      return card.url ? { href: card.url, label: `Open on ${card.source}` } : null;
    case "event":
      return card.url ? { href: card.url, label: "Open it" } : null;
    case "resurface":
      return { href: card.href, label: "Open it" };
    case "topic":
    case "action":
    case "check_in":
    case "wind_down":
      return null;
  }
}

export function hasDiscoverTopic(card: DiscoverCard): boolean {
  return "topic" in card;
}

export function countTopicArticles(cards: readonly DiscoverCard[], topic: string): number {
  const key = normaliseComparableText(topic);

  return cards.filter(
    (card) =>
      card.kind === "read" && Boolean(card.sourceId) && normaliseComparableText(card.topic) === key,
  ).length;
}

export function cardTopic(card: DiscoverCard): string {
  return "topic" in card ? card.topic : "";
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
    case "read": {
      const piece = card.sourceId ? "this piece" : `${card.url}`;
      const read = card.sourceId ? "" : "Read ";

      return [
        suggestion(
          card,
          "gist",
          "Give me the gist",
          `${read}${piece}${read ? " and" : ":"} give me the gist in five bullet points.`,
        ),
        suggestion(
          card,
          "why",
          "Why does this matter to me?",
          `${read}${piece}. Given what you know about me, why might it matter?`,
        ),
        suggestion(
          card,
          "counter",
          "What's the other side?",
          `${read}${piece}${read ? " and" : ":"} give me the strongest counterargument to it.`,
        ),
      ];
    }

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
    case "watch":
    case "listen":
      return [
        suggestion(
          card,
          "about",
          "What is this about?",
          `Tell me about "${card.title}" from ${card.source} (${card.url}) and whether it is worth my time.`,
        ),
        suggestion(
          card,
          "more",
          "More like this",
          `Find me more like "${card.title}" from ${card.source}, given what you know I like.`,
        ),
      ];
    case "event":
      return [
        suggestion(
          card,
          "calendar",
          "Add it to my calendar",
          `Add "${card.title}" on ${card.when}${card.where ? ` at ${card.where}` : ""} to my calendar. Show me the event before you create it.`,
        ),
        suggestion(
          card,
          "remind",
          "Remind me beforehand",
          `Remind me about "${card.title}" an hour before ${card.when}.`,
        ),
      ];
    case "inbox":
      return [
        suggestion(
          card,
          "gist",
          "Give me the gist",
          `Give me the gist of "${card.title}" from ${card.source}${card.url ? ` (${card.url})` : ""} in five bullet points.`,
        ),
        suggestion(
          card,
          "save",
          "Save it for later",
          `Save "${card.title}" from ${card.source}${card.url ? ` (${card.url})` : ""} to my reading list.`,
        ),
      ];
    case "wind_down":
      return [];
  }
}
