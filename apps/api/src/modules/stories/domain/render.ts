import type { RelatedStory, StoryPage } from "@ngriffin_uk/polychat-schemas";

const MODEL_ARTICLE_LIMIT = 12;

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
      page.entities.map(
        (entity) => `${entity.name} (${entity.kind}, ${entity.role}, entity ${entity.id})`,
      ),
    ),
    ...section("Before this", page.before.map(describeRelatedStory)),
    ...section(
      "Articles",
      page.articles
        .slice(0, MODEL_ARTICLE_LIMIT)
        .map((article) => `${article.outlet}: ${article.headline} ${article.url}`),
    ),
  ].join("\n\n");
}

export function describeRelatedStory(story: RelatedStory): string {
  return `${story.title} (story ${story.id}, ${story.outletCount} outlets, last article ${story.lastArticleAt.slice(0, 10)}${story.kind ? `, ${story.kind}` : ""})`;
}

export function renderCoverageComparison(page: StoryPage): string {
  const angles = new Map(
    (page.version?.outlets ?? []).map((outlet) => [outlet.source, outlet.angle]),
  );

  return [
    `# Coverage of ${page.story.title}`,
    `Story ${page.story.id}: ${page.story.outletCount} outlets, ${page.story.articleCount} articles, opened ${page.story.openedAt.slice(0, 10)}, ${page.story.status}.`,
    ...section(
      "By outlet, in the order they arrived",
      page.coverage.map((outlet) => {
        const angle = angles.get(outlet.outlet);

        return `${outlet.outlet}: ${outlet.articleCount} article${outlet.articleCount === 1 ? "" : "s"}, first ${outlet.firstPublishedAt.slice(0, 16).replace("T", " ")}${outlet.leadCount > 0 ? ", broke the story" : ""}${angle ? `. Angle: ${angle}` : ""}`;
      }),
    ),
    ...(page.version
      ? [
          ...section("What they agree on", page.version.agreed),
          ...section("Where they differ", page.version.disputed),
          ...section("What's missing", page.version.gaps),
        ]
      : ["No comparison has been written yet; only article counts are available."]),
  ].join("\n\n");
}
