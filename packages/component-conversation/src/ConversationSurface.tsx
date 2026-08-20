import type { ReactNode } from "react";

export interface ConversationMessageView {
  id: string;
  role: "user" | "assistant" | "system";
  content: ReactNode;
  status?: "streaming" | "complete" | "failed";
}

export interface ConversationTimelineProps {
  messages: ConversationMessageView[];
  emptyState?: ReactNode;
  renderActions?: (message: ConversationMessageView) => ReactNode;
}

export function ConversationTimeline({
  messages,
  emptyState,
  renderActions,
}: ConversationTimelineProps) {
  if (messages.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <ol className="polychat-conversation-timeline" aria-label="Conversation">
      {messages.map((message) => (
        <li key={message.id} data-role={message.role} data-status={message.status}>
          <div>{message.content}</div>
          {renderActions && <footer>{renderActions(message)}</footer>}
        </li>
      ))}
    </ol>
  );
}

export interface ConversationComposerState {
  value: string;
  placeholder?: string;
  isSubmitting?: boolean;
  unavailableReason?: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => Promise<void> | void;
}

export interface ConversationController {
  messages: ConversationMessageView[];
  composer: ConversationComposerState;
  errorMessage?: string;
  emptyState?: ReactNode;
  renderActions?: (message: ConversationMessageView) => ReactNode;
}

export function ConversationComposer({
  value,
  placeholder = "Message Polychat",
  isSubmitting = false,
  unavailableReason,
  onChange,
  onSubmit,
}: ConversationComposerState) {
  const canSubmit = value.trim().length > 0 && !isSubmitting && !unavailableReason;

  return (
    <form
      className="polychat-conversation-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) {
          void onSubmit(value.trim());
        }
      }}
    >
      <label>
        <span className="polychat-conversation-visually-hidden">Message</span>
        <textarea
          value={value}
          placeholder={placeholder}
          disabled={Boolean(unavailableReason)}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <button type="submit" disabled={!canSubmit} title={unavailableReason}>
        {isSubmitting ? "Sending…" : "Send"}
      </button>
      {unavailableReason && <small>{unavailableReason}</small>}
    </form>
  );
}

export function ConversationSurface({ controller }: { controller: ConversationController }) {
  return (
    <section className="polychat-conversation-surface" aria-label="Conversation">
      {controller.errorMessage && <p role="alert">{controller.errorMessage}</p>}
      <ConversationTimeline
        messages={controller.messages}
        emptyState={controller.emptyState}
        renderActions={controller.renderActions}
      />
      <ConversationComposer {...controller.composer} />
    </section>
  );
}
