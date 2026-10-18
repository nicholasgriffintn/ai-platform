const TELEGRAM_REACTIONS: Readonly<Record<string, string>> = {
  "👀": "👀",
  "✅": "👌",
  "⚠️": "🤔",
  "👍": "👍",
  "👎": "👎",
  "❤️": "❤",
  "🎉": "🎉",
  "😂": "😁",
  "🙏": "🙏",
};

export function toTelegramReaction(emoji: string): string | null {
  return TELEGRAM_REACTIONS[emoji] ?? null;
}
