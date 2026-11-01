import type { DiscoverResearchResult } from "../research";

export type DiscoverSignalGroup =
  | "listening"
  | "reading"
  | "watching"
  | "fitness"
  | "calendar"
  | "mail"
  | "tasks"
  | "work"
  | "places"
  | "pictures"
  | "models"
  | "social"
  | "playing";

export interface DiscoverSignalRead {
  date: string;
  timezone: string;
  now: Date;
  location: string | null;
  topics: readonly string[];
}

export interface DiscoverSignalExpansion {
  operation: string;
  requests: (result: unknown, read: DiscoverSignalRead) => Record<string, unknown>[];
}

interface DiscoverSignalBase {
  id: string;
  providerId: string;
  group: DiscoverSignalGroup;
  title: string;
  description: string;
  digest: (result: unknown) => string[];
  items?: (result: unknown, read: DiscoverSignalRead) => DiscoverResearchResult[];
  needsLocation?: boolean;
  needsTopics?: boolean;
}

export interface DiscoverConnectorSignal extends DiscoverSignalBase {
  kind?: "connector";
  operation: string;
  parameters: (read: DiscoverSignalRead) => Record<string, unknown>;
  expand?: DiscoverSignalExpansion;
}

export interface DiscoverPublicSignal extends DiscoverSignalBase {
  kind: "public";
  format: "json" | "feed";
  url: (read: DiscoverSignalRead) => string;
}

export type DiscoverSignal = DiscoverConnectorSignal | DiscoverPublicSignal;

export const DISCOVER_SIGNAL_GROUPS: Record<
  DiscoverSignalGroup,
  { label: string; oneOf: boolean }
> = {
  listening: { label: "Listening", oneOf: false },
  reading: { label: "Reading", oneOf: false },
  watching: { label: "Watching", oneOf: false },
  fitness: { label: "Fitness", oneOf: true },
  calendar: { label: "Calendar", oneOf: true },
  mail: { label: "Mail", oneOf: true },
  tasks: { label: "Tasks", oneOf: true },
  work: { label: "Work", oneOf: false },
  places: { label: "Places", oneOf: true },
  pictures: { label: "Pictures", oneOf: false },
  models: { label: "Models", oneOf: false },
  social: { label: "Social", oneOf: false },
  playing: { label: "Playing", oneOf: false },
};
