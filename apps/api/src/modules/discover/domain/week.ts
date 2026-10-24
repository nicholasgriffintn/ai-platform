export const YOUR_WEEK_TITLE = "Your week";

export const YOUR_WEEK_FOCUS =
  "A warm three-minute look back at one person's week: what they made, what they learned and what they finished. Speak to them directly, credit real progress without flattery, and end with one thing worth picking up next week. Use only the material.";

export interface WeekMaterial {
  made: readonly string[];
  notebooks: readonly string[];
  chats: readonly string[];
}

export function isSundayEdition(date: string): boolean {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
}

function list(title: string, lines: readonly string[]): string[] {
  return lines.length > 0 ? [`## ${title}`, ...lines.map((line) => `- ${line}`)] : [];
}

export function buildWeekMaterial(week: WeekMaterial): string | null {
  const sections = [
    ...list("Things they made", week.made),
    ...list("Notebooks they worked in", week.notebooks),
    ...list("What they talked about", week.chats),
  ];

  return sections.length > 0 ? ["# Their week", ...sections].join("\n") : null;
}
