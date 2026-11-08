import type { RelatedStory, StoryPage } from "@ngriffin_uk/polychat-schemas";

function section(heading: string, lines: readonly string[]): string[] {
  return lines.length > 0
    ? [`## ${heading}\n\n${lines.map((line) => `- ${line}`).join("\n")}`]
    : [];
}

export function renderStoryForModel(page: StoryPage): string {
  const { story, version } = page;

  return [
    `# ${story.title}`,
    `Story ${story.id}: ${story.outletCount} outlets, ${story.articleCount} articles, ${story.status}, last article ${story.lastArticleAt}.`,
    ...(version
      ? [
          ...section("Overview", version.overview),
          ...section("What they agree on", version.agreed),
          ...section(
            "How each outlet tells it",
            version.outlets.map((outlet) => `${outlet.source}: ${outlet.angle}`),
          ),
          ...section("Where they differ", version.disputed),
          ...section("What's missing", version.gaps),
        ]
      : ["No overview has been written yet."]),
    ...section(
      "Quotes",
      page.quotes.map(
        (quote) =>
          `"${quote.text}" ${quote.speaker}${quote.context ? `, ${quote.context}` : ""} (${quote.outlet})`,
      ),
    ),
    ...section(
      "People and organisations",
      page.entities.map((entity) => `${entity.name} (${entity.kind}, ${entity.role})`),
    ),
    ...section("Before this", page.before.map(describeRelatedStory)),
    ...section(
      "Articles",
      page.articles.map((article) => `${article.outlet}: ${article.headline} ${article.url}`),
    ),
  ].join("\n\n");
}

export function describeRelatedStory(story: RelatedStory): string {
  return `${story.title} (story ${story.id}, ${story.outletCount} outlets, last article ${story.lastArticleAt.slice(0, 10)}${story.kind ? `, ${story.kind}` : ""})`;
}
