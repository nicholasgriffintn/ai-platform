export interface PodcastFeedEpisode {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  audioUrl: string;
  mimeType: string;
  byteSize: number;
  durationSeconds?: number;
  imageUrl?: string;
}

export interface PodcastFeed {
  title: string;
  description: string;
  link: string;
  feedUrl: string;
  author: string;
  language: string;
  imageUrl?: string;
  episodes: PodcastFeedEpisode[];
}

export function escapeXml(value: string): string {
  return (
    value
      // oxlint-disable-next-line no-control-regex -- XML 1.0 forbids these characters, so they are stripped
      .replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
  );
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = String(seconds % 60).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
}

function toRfc822(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);

  return Number.isNaN(date.getTime()) ? new Date(0).toUTCString() : date.toUTCString();
}

function renderEpisode(episode: PodcastFeedEpisode): string {
  return [
    "    <item>",
    `      <title>${escapeXml(episode.title)}</title>`,
    `      <description>${escapeXml(episode.description)}</description>`,
    `      <guid isPermaLink="false">${escapeXml(episode.id)}</guid>`,
    `      <pubDate>${toRfc822(episode.publishedAt)}</pubDate>`,
    `      <enclosure url="${escapeXml(episode.audioUrl)}" length="${episode.byteSize}" type="${escapeXml(episode.mimeType)}"/>`,
    episode.durationSeconds !== undefined
      ? `      <itunes:duration>${formatDuration(episode.durationSeconds)}</itunes:duration>`
      : null,
    episode.imageUrl ? `      <itunes:image href="${escapeXml(episode.imageUrl)}"/>` : null,
    "    </item>",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function buildPodcastFeed(feed: PodcastFeed): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(feed.title)}</title>`,
    `    <description>${escapeXml(feed.description)}</description>`,
    `    <link>${escapeXml(feed.link)}</link>`,
    `    <language>${escapeXml(feed.language)}</language>`,
    `    <atom:link href="${escapeXml(feed.feedUrl)}" rel="self" type="application/rss+xml"/>`,
    `    <itunes:author>${escapeXml(feed.author)}</itunes:author>`,
    "    <itunes:explicit>false</itunes:explicit>",
    "    <itunes:block>Yes</itunes:block>",
    feed.imageUrl ? `    <itunes:image href="${escapeXml(feed.imageUrl)}"/>` : null,
    ...feed.episodes.map(renderEpisode),
    "  </channel>",
    "</rss>",
    "",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
