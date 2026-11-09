export const TOPIC_SERIES_COLOURS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export const OTHER_TOPIC_COLOUR = "color-mix(in oklab, var(--muted-foreground) 40%, transparent)";

export interface TopicSwatch {
  key: string;
  label: string;
  colour: string;
}

export function topicSwatches(
  topics: readonly { key: string; label: string }[],
  withOther: boolean,
): TopicSwatch[] {
  return [
    ...topics.slice(0, TOPIC_SERIES_COLOURS.length).map((topic, index) => ({
      key: topic.key,
      label: topic.label,
      colour: TOPIC_SERIES_COLOURS[index] ?? OTHER_TOPIC_COLOUR,
    })),
    ...(withOther ? [{ key: "other", label: "Other", colour: OTHER_TOPIC_COLOUR }] : []),
  ];
}
