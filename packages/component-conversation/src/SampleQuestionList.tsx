import {
	Brain,
	Code,
	HandHelping,
	Laugh,
	Lightbulb,
	SendHorizontal,
	Shield,
	Sparkles,
	Zap,
} from "lucide-react";
import type { ReactNode } from "react";

export interface SuggestedQuestion {
	id: string;
	label: string;
	prompt: string;
	category?: string;
}

export interface SampleQuestionListProps {
	questions: SuggestedQuestion[];
	isLoading?: boolean;
	showRefresh?: boolean;
	challenging?: boolean;
	onRefresh?: () => void;
	onChallengingChange?: (enabled: boolean) => void;
	onSelect: (question: SuggestedQuestion) => void;
}

function getQuestionIcon(category?: string) {
	const iconProps = { "aria-hidden": true, size: 16 } as const;

	switch (category) {
		case "creative":
			return <Sparkles {...iconProps} />;
		case "productivity":
			return <Lightbulb {...iconProps} />;
		case "technical":
		case "coding":
			return <Code {...iconProps} />;
		case "practical":
			return <HandHelping {...iconProps} />;
		case "analytical":
			return <Brain {...iconProps} />;
		case "ethical":
			return <Shield {...iconProps} />;
		case "humor":
			return <Laugh {...iconProps} />;
		case "challenging":
			return <Zap {...iconProps} />;
		default:
			return <SendHorizontal {...iconProps} />;
	}
}

export function SampleQuestionList({
	questions,
	isLoading = false,
	showRefresh = false,
	challenging = false,
	onRefresh,
	onChallengingChange,
	onSelect,
}: SampleQuestionListProps) {
	if (isLoading)
		return (
			<div
				className="polychat-conversation-question-skeleton"
				role="status"
				aria-label="Loading suggested questions"
			>
				<div className="polychat-conversation-question-skeleton-header" aria-hidden="true">
					<span />
					<span />
				</div>
				<div className="polychat-conversation-question-skeleton-grid" aria-hidden="true">
					{Array.from({ length: 4 }, (_, index) => (
						<span key={index} />
					))}
				</div>
				<div className="polychat-conversation-question-skeleton-toggle" aria-hidden="true" />
			</div>
		);
	if (questions.length === 0) return null;

	return (
		<section
			className="polychat-conversation-questions"
			aria-labelledby="polychat-suggested-questions"
		>
			<header className="polychat-conversation-question-header">
				<h3 id="polychat-suggested-questions">Try asking about...</h3>
				{showRefresh && (
					<button type="button" className="polychat-conversation-refresh" onClick={onRefresh}>
						<Sparkles size={14} aria-hidden="true" />
						<span>Refresh</span>
					</button>
				)}
			</header>
			<div className="polychat-conversation-question-grid" aria-label="Suggested questions">
				{questions.map((question) => (
					<button
						key={question.id}
						type="button"
						className="polychat-conversation-question"
						data-challenging={question.category === "challenging" || undefined}
						onClick={() => onSelect(question)}
					>
						<span className="polychat-conversation-question-icon">
							{getQuestionIcon(question.category)}
						</span>
						<span>{question.label}</span>
					</button>
				))}
			</div>
			{onChallengingChange && (
				<label className="polychat-conversation-challenging">
					<input
						type="checkbox"
						className="polychat-conversation-visually-hidden"
						checked={challenging}
						onChange={(event) => onChallengingChange(event.target.checked)}
					/>
					<span
						className="polychat-conversation-challenging-track"
						data-enabled={challenging || undefined}
						aria-hidden="true"
					>
						<span />
					</span>
					<span className="polychat-conversation-challenging-label">
						<Zap size={12} aria-hidden="true" />
						Hard
					</span>
				</label>
			)}
		</section>
	);
}

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
	if (messages.length === 0) return <>{emptyState}</>;
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
				if (canSubmit) void onSubmit(value.trim());
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
