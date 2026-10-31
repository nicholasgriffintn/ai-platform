import type { ChatSuggestion } from "@ngriffin_uk/polychat-utility-react";
import {
  Brain,
  Code,
  Compass,
  GraduationCap,
  Image,
  Lightbulb,
  PenLine,
  Plug,
  RadioTower,
  Repeat,
  SendHorizontal,
  Shuffle,
  Timer,
  UsersRound,
} from "lucide-react";

export type { ChatSuggestion } from "@ngriffin_uk/polychat-utility-react";

export type ChatSuggestionLayout = "grid" | "pills" | "list";

export interface ChatSuggestionListProps {
  suggestions: ChatSuggestion[];
  isLoading?: boolean;
  showRefresh?: boolean;
  layout?: ChatSuggestionLayout;
  onRefresh?: () => void;
  onSelect: (suggestion: ChatSuggestion) => void;
}

const SUGGESTION_ICONS: Record<string, typeof SendHorizontal> = {
  background: Timer,
  connector: Plug,
  council: UsersRound,
  design: PenLine,
  education: GraduationCap,
  engineering: Code,
  everyday: Lightbulb,
  image: Image,
  leadership: Compass,
  live: RadioTower,
  recipe: Repeat,
  research: Brain,
  writing: PenLine,
};

function getSuggestionIcon(category: string) {
  const Icon = SUGGESTION_ICONS[category] ?? SendHorizontal;

  return <Icon aria-hidden size={16} />;
}

export function ChatSuggestionList({
  suggestions,
  isLoading = false,
  showRefresh = false,
  layout = "grid",
  onRefresh,
  onSelect,
}: ChatSuggestionListProps) {
  if (isLoading) {
    if (layout === "list") {
      return (
        <output
          className="polychat-conversation-suggestion-list-skeleton"
          aria-label="Loading suggestions"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <span key={index} aria-hidden="true" />
          ))}
        </output>
      );
    }

    if (layout !== "grid") {
      return null;
    }

    return (
      <output
        className="polychat-conversation-suggestion-skeleton block"
        aria-label="Loading suggestions"
      >
        <div className="polychat-conversation-suggestion-skeleton-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <div className="polychat-conversation-suggestion-skeleton-footer" aria-hidden="true" />
      </output>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section
      className="polychat-conversation-suggestions"
      data-layout={layout}
      aria-label="Suggestions"
    >
      <div
        className="polychat-conversation-suggestion-grid"
        aria-label="Suggested prompts"
        data-dynamic-copy=""
      >
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            type="button"
            className="polychat-conversation-suggestion"
            data-suggestion-id={suggestion.id}
            title={suggestion.hint}
            onClick={() => onSelect(suggestion)}
          >
            <span className="polychat-conversation-suggestion-icon">
              {getSuggestionIcon(suggestion.category)}
            </span>
            <span>{suggestion.label}</span>
          </button>
        ))}
      </div>
      {showRefresh && (
        <div className="polychat-conversation-suggestion-footer">
          <button
            type="button"
            className="polychat-conversation-refresh"
            aria-label={layout === "pills" ? "Shuffle suggestions" : undefined}
            onClick={onRefresh}
          >
            <Shuffle size={14} aria-hidden="true" />
            {layout === "pills" ? null : <span>Shuffle</span>}
          </button>
        </div>
      )}
    </section>
  );
}
