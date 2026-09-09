import { Button, Input, cn } from "@ngriffin_uk/polychat-component-ui";
import { ChevronLeft, ChevronRight, CircleQuestionMark, PencilLine } from "lucide-react";

import type { ToolInteractionHandler } from "../registry";
import { readUserQuestionSet } from "./userQuestionData";
import { useUserQuestionSubmission } from "./useUserQuestionSubmission";

export function UserQuestionView({
  data,
  embedded,
  onToolInteraction,
}: {
  data: unknown;
  embedded: boolean;
  onToolInteraction?: ToolInteractionHandler;
}) {
  const questionSet = readUserQuestionSet(data);
  const {
    answerCurrent,
    currentIndex,
    currentQuestion,
    isResolved,
    isSubmitting,
    otherAnswer,
    setCurrentIndex,
    setOtherAnswer,
    submissionStatus,
  } = useUserQuestionSubmission(questionSet, onToolInteraction);

  if (!questionSet) {
    return null;
  }

  return (
    <section
      data-responsetype="user-question"
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface-elevated text-sm shadow-sm",
        embedded && "mx-auto w-full max-w-3xl",
      )}
      aria-label="Questions from the agent"
    >
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <CircleQuestionMark className="mt-0.5 h-4 w-4 shrink-0 text-attention" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">The agent needs your input</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Answer these questions to continue the task.
          </p>
        </div>
        {questionSet.questions.length > 1 && !isResolved ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {currentIndex + 1} of {questionSet.questions.length}
          </span>
        ) : null}
      </div>

      {isResolved ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Answers sent. The agent can continue from here.
        </p>
      ) : currentQuestion ? (
        <div className="space-y-3 p-3">
          <p className="px-1 text-sm font-medium text-foreground">{currentQuestion.prompt}</p>
          {submissionStatus === "failed" ? (
            <p role="alert" className="px-1 text-xs font-medium text-failure">
              Answers were not submitted. Try again.
            </p>
          ) : isSubmitting ? (
            <p aria-live="polite" className="px-1 text-xs text-muted-foreground">
              Sending answers…
            </p>
          ) : null}

          {currentQuestion.options.length > 0 ? (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void answerCurrent(option.label)}
                  className="group flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none focus-visible:ring-inset"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-xs font-medium text-muted-foreground group-hover:bg-selection">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{option.label}</span>
                    {option.description ? (
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          ) : null}

          {currentQuestion.allowOther ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void answerCurrent(otherAnswer);
              }}
            >
              <div className="relative min-w-0 flex-1">
                <PencilLine
                  size={15}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="text"
                  value={otherAnswer}
                  disabled={isSubmitting}
                  onChange={(event) => setOtherAnswer(event.target.value)}
                  placeholder="Write an answer…"
                  aria-label={`Answer: ${currentQuestion.prompt}`}
                  className="h-10 rounded-lg border-border-strong bg-surface pr-3 pl-9 text-sm"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting || !otherAnswer.trim()}
              >
                {currentIndex === questionSet.questions.length - 1 ? "Send answers" : "Next"}
              </Button>
            </form>
          ) : null}

          {currentIndex > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<ChevronLeft size={14} />}
              disabled={isSubmitting}
              onClick={() => setCurrentIndex(currentIndex - 1)}
            >
              Previous question
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
