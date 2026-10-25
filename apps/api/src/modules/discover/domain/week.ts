export const YOUR_WEEK_TITLE = "Your week";

export const YOUR_WEEK_FOCUS =
  "A warm three-minute look back at one person's week: what they made, what they learned and what they finished. Speak to them directly. Say what each piece contains, found or decided, using the excerpts in the material, and name the specifics: the plan's points, the quiz's subject, the answer a chat reached. Credit real progress without flattery. Never remark on what the material does not record; leave out anything you cannot describe. End with one thing worth picking up next week.";

export interface WeekMadeItem {
  title: string;
  kind: string;
  excerpt: string;
}

export interface WeekNotebookItem {
  title: string;
  about: string;
}

export interface WeekChatItem {
  title: string;
  asked: string;
  answered: string;
}

export interface WeekMaterial {
  made: readonly WeekMadeItem[];
  notebooks: readonly WeekNotebookItem[];
  chats: readonly WeekChatItem[];
}

export function isSundayEdition(date: string): boolean {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
}

function section(title: string, lines: readonly string[]): string[] {
  return lines.length > 0 ? [`## ${title}`, ...lines] : [];
}

function detail(label: string, text: string): string {
  return text ? `\n  ${label}: ${text}` : "";
}

export function buildWeekMaterial(week: WeekMaterial): string | null {
  const sections = [
    ...section(
      "Things they made",
      week.made.map(
        (item) => `- **${item.title}** (${item.kind})${detail("Contents", item.excerpt)}`,
      ),
    ),
    ...section(
      "Notebooks they worked in",
      week.notebooks.map((item) => `- **${item.title}**${detail("About", item.about)}`),
    ),
    ...section(
      "What they talked about",
      week.chats.map(
        (item) =>
          `- **${item.title}**${detail("They asked", item.asked)}${detail("Poly answered", item.answered)}`,
      ),
    ),
  ];

  return sections.length > 0 ? ["# Their week", ...sections].join("\n") : null;
}
