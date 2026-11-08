export interface StoryMaterialArticle {
  source: string;
  title: string;
  content: string;
}

export function buildStoryMaterial(
  topic: string,
  articles: readonly StoryMaterialArticle[],
): string {
  return [
    `Topic: ${topic}`,
    ...articles.map(
      (article, index) =>
        `## Article ${index + 1}: ${article.source}, "${article.title}"\n\n${article.content}`,
    ),
  ].join("\n\n");
}
