const DAY_HEADING = /^## (\d{4}-\d{2}-\d{2})$/u;

export interface DailyLogDay {
  date: string;
  lines: readonly string[];
}

export function parseDailyLog(content: string): DailyLogDay[] {
  const days: { date: string; lines: string[] }[] = [];

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    const heading = DAY_HEADING.exec(line);
    const current = days.at(-1);

    if (heading?.[1]) {
      days.push({ date: heading[1], lines: [] });
    } else if (current && line.startsWith("- ")) {
      current.lines.push(line.slice(2).trim());
    }
  }

  return days;
}

export function mergeDailyLog(
  existing: readonly DailyLogDay[],
  day: DailyLogDay,
  daysKept: number,
): DailyLogDay[] {
  return [
    ...(day.lines.length > 0 ? [day] : []),
    ...existing.filter((kept) => day.lines.length === 0 || kept.date !== day.date),
  ]
    .sort((left, right) => (left.date < right.date ? 1 : -1))
    .slice(0, daysKept);
}

export function renderDailyLog(days: readonly DailyLogDay[]): string {
  return days
    .map((day) =>
      [`## ${day.date}`, ...day.lines.map((line) => `- ${line.replace(/\s+/gu, " ").trim()}`)].join(
        "\n",
      ),
    )
    .join("\n\n");
}
