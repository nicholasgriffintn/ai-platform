const SLACK_EMOJI_NAMES: Readonly<Record<string, string>> = {
  "👀": "eyes",
  "✅": "white_check_mark",
  "⚠️": "warning",
  "👍": "+1",
  "👎": "-1",
  "❤️": "heart",
  "🎉": "tada",
  "😂": "joy",
  "🙏": "pray",
};

export function toSlackEmojiName(emoji: string): string | null {
  return SLACK_EMOJI_NAMES[emoji] ?? null;
}
