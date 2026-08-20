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

export interface ChatSuggestion {
  id: string;
  label: string;
  prompt?: string;
  category: string;
  hint?: string;
}

export interface ChatSuggestionListProps {
  suggestions: ChatSuggestion[];
  isLoading?: boolean;
  showRefresh?: boolean;
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
  onRefresh,
  onSelect,
}: ChatSuggestionListProps) {
  if (isLoading) {
    return (
      <div
        className="polychat-conversation-suggestion-skeleton"
        role="status"
        aria-label="Loading suggestions"
      >
        <div className="polychat-conversation-suggestion-skeleton-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <div className="polychat-conversation-suggestion-skeleton-footer" aria-hidden="true" />
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className="polychat-conversation-suggestions" aria-label="Suggestions">
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
          <button type="button" className="polychat-conversation-refresh" onClick={onRefresh}>
            <Shuffle size={14} aria-hidden="true" />
            <span>Shuffle</span>
          </button>
        </div>
      )}
    </section>
  );
}
