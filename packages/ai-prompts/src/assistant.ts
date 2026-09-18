import { getPromptText, renderPrompt } from "./prompts.js";

export interface MemoryClassifierPromptOptions {
  date?: Date;
}

export function buildMemoryClassifierPrompt({
  date = new Date(),
}: MemoryClassifierPromptOptions = {}): string {
  const todaysDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const nextFriday = new Date(
    date.getTime() + (((12 - date.getDay()) % 7) + 1) * 24 * 60 * 60 * 1000,
  );
  const thisYear = date.getFullYear();

  return renderPrompt("memory/classifier", {
    todaysDate,
    nextFriday: nextFriday.toString(),
    thisYear,
  });
}

export function buildMemoryNormaliserPrompt(): string {
  return getPromptText("memory/normaliser");
}

export function buildMemorySummariserPrompt(): string {
  return getPromptText("memory/summariser");
}

export interface MemorySynthesisPromptOptions {
  memories: string;
  existingSynthesis?: string | null;
  date?: Date;
}

export function buildMemorySynthesisPrompt({
  memories,
  existingSynthesis,
  date = new Date(),
}: MemorySynthesisPromptOptions): string {
  return renderPrompt("memory/synthesis", {
    memories,
    existingSynthesis: existingSynthesis ?? undefined,
    todaysDate: date.toISOString().split("T")[0],
  });
}

export function buildConversationSummarisePrompt({
  modeHint = "",
}: { modeHint?: string } = {}): string {
  return renderPrompt("conversation/summarise", { modeHint });
}

export interface TitleMessage {
  role: string;
  content: unknown;
}

export function buildConversationTitlePrompt({
  messages,
}: {
  messages: readonly TitleMessage[];
}): string {
  const transcript = messages
    .map(
      (message) =>
        `${message.role.toUpperCase()}: ${
          typeof message.content === "string" ? message.content : JSON.stringify(message.content)
        }`,
    )
    .join("\n");

  return renderPrompt("conversation/title", { messages: transcript });
}

export function buildDocumentMetadataPrompt(): string {
  return getPromptText("document/metadata");
}

export function buildDocumentFormatPrompt(): string {
  return getPromptText("document/format");
}

export interface DocumentNotesPromptOptions {
  documentTypeDescriptor: string;
  sections: readonly string[];
  useVideoAnalysis?: boolean;
  timestamps?: boolean;
  extraPrompt?: string | null;
}

export function buildDocumentNotesPrompt({
  documentTypeDescriptor,
  sections,
  useVideoAnalysis = false,
  timestamps = false,
  extraPrompt,
}: DocumentNotesPromptOptions): string {
  return renderPrompt("document/notes", {
    documentTypeDescriptor,
    selectedSections: sections.map((section) => `- ${section}`).join("\n"),
    useVideoAnalysis: useVideoAnalysis ? "true" : undefined,
    timestamps: timestamps ? "true" : undefined,
    extraPrompt: extraPrompt ?? undefined,
  });
}

export function buildContentExtractionPrompt(): string {
  return getPromptText("content/extract");
}

export interface ArticlePromptOptions {
  metadataSection: string;
  article: string;
}

export function buildArticleAnalysisPrompt({
  metadataSection,
  article,
}: ArticlePromptOptions): string {
  return renderPrompt("apps/articles/analyse", { metadataSection, article });
}

export function buildArticleSummaryPrompt({
  metadataSection,
  article,
}: ArticlePromptOptions): string {
  return renderPrompt("apps/articles/summarise", { metadataSection, article });
}

export function buildArticleReportPrompt({
  metadataSection,
  articles,
}: {
  metadataSection: string;
  articles: string;
}): string {
  return renderPrompt("apps/articles/report", { metadataSection, articles });
}
