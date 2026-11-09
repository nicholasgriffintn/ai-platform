import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Compass,
  Headphones,
  History,
  Mail,
  MessageCircleQuestion,
  MonitorPlay,
  MoonStar,
  Newspaper,
  Play,
  Repeat,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import {
  isDiscoverGraphItem,
  type DiscoverGraphItem,
  type DiscoverItem,
} from "./discover-items.js";

export interface DiscoverItemKind {
  label: string;
  icon: LucideIcon;
  placeholder: string;
}

function ask(noun: string): string {
  return `Ask about this ${noun}`;
}

function graphItemKind(item: DiscoverGraphItem): DiscoverItemKind {
  switch (item.type) {
    case "story":
      return { label: "Story", icon: Newspaper, placeholder: ask("story") };
    case "entity":
      return { label: "Person or organisation", icon: UserRound, placeholder: "Ask about them" };
    case "angles":
      return { label: "Angles", icon: BarChart3, placeholder: "Ask about this week's coverage" };
  }
}

export function discoverItemKind(item: DiscoverItem): DiscoverItemKind {
  if (isDiscoverGraphItem(item)) {
    return graphItemKind(item);
  }

  if (item.type === "media") {
    switch (item.media) {
      case "episode":
        return { label: "Episode", icon: MonitorPlay, placeholder: ask("episode") };
      case "perch":
        return { label: "The Perch", icon: Headphones, placeholder: "Ask about today's round-up" };
      case "week":
        return { label: "Your week", icon: Headphones, placeholder: "Ask about your week" };
      case "wind_down":
        return { label: "Wind down", icon: MoonStar, placeholder: "" };
      case "story":
        return { label: "Tonight's story", icon: MoonStar, placeholder: "" };
    }
  }

  switch (item.card.kind) {
    case "topic":
      return { label: "Worth a look", icon: Compass, placeholder: ask("piece") };
    case "read":
      return { label: "Reading", icon: BookOpen, placeholder: ask("article") };
    case "inbox":
      return { label: "Inbox", icon: Mail, placeholder: ask("message") };
    case "action":
      return {
        label: "Worth doing",
        icon: Repeat,
        placeholder: "Change the plan, or ask about it",
      };
    case "check_in":
      return { label: "Checking in", icon: MessageCircleQuestion, placeholder: "Reply to Poly" };
    case "resurface":
      return { label: "From before", icon: History, placeholder: "Ask about this" };
    case "event":
      return { label: "Coming up", icon: CalendarDays, placeholder: ask("event") };
    case "watch":
      return { label: "Watch", icon: Play, placeholder: ask("video") };
    case "listen":
      return { label: "Listen", icon: Headphones, placeholder: ask("episode") };
    case "wind_down":
      return { label: "Tonight's story", icon: MoonStar, placeholder: "" };
  }
}
