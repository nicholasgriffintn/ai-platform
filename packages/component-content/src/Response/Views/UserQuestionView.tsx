import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { ChevronLeft, ChevronRight, CircleQuestionMark, PencilLine } from "lucide-react";
import { useState } from "react";

import type { ToolInteractionHandler } from "../registry";
import { readUserQuestionSet, type UserQuestionAnswer } from "./userQuestionData";

const TOOL_NAME = "ask_user";

function formatAnswers(answers: UserQuestionAnswer[]): string {
  return answers.map(({ questionId, answer }) => `${questionId}: ${answer}`).join("\n");
}

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<UserQuestionAnswer[]>([]);
  const [otherAnswer, setOtherAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!questionSet) {
    return null;
  }

  const isResolved = questionSet.resolved || submitted;
  const currentQuestion = questionSet.questions[currentIndex];
  const answerCurrent = (answer: string) => {
    const trimmed = answer.trim();

    if (!trimmed || !currentQuestion || isResolved || !onToolInteraction) {
      return;
    }

    const nextAnswers = [
      ...answers.filter((item) => item.questionId !== currentQuestion.id),
      { questionId: currentQuestion.id, answer: trimmed },
    ];

    setAnswers(nextAnswers);
    setOtherAnswer("");

    if (currentIndex < questionSet.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);

      return;
    }

    setSubmitted(true);
    onToolInteraction(TOOL_NAME, "submitPrompt", {
      interactionId: questionSet.interactionId,
      answers: nextAnswers,
      input: formatAnswers(nextAnswers),
    });
  };

  return (
    <section
      data-responsetype="user-question"
      className={cn(
        "overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900",
        embedded && "mx-auto w-full max-w-3xl",
      )}
      aria-label="Questions from the agent"
    >
      <div className="flex items-start gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <CircleQuestionMark
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-950 dark:text-zinc-100">The agent needs your input</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Answer these questions to continue the task.
          </p>
        </div>
        {questionSet.questions.length > 1 && !isResolved ? (
          <span className="shrink-0 text-xs text-zinc-500">
            {currentIndex + 1} of {questionSet.questions.length}
          </span>
        ) : null}
      </div>

      {isResolved ? (
        <p className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
          Answers sent. The agent can continue from here.
        </p>
      ) : currentQuestion ? (
        <div className="space-y-3 p-3">
          <p className="px-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {currentQuestion.prompt}
          </p>

          {currentQuestion.options.length > 0 ? (
            <div className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-950/40">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => answerCurrent(option.label)}
                  className="group flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-zinc-800/70"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs font-medium text-zinc-600 group-hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:bg-zinc-700">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="mt-0.5 block text-xs leading-5 text-zinc-500">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-zinc-400" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}

          {currentQuestion.allowOther ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                answerCurrent(otherAnswer);
              }}
            >
              <div className="relative min-w-0 flex-1">
                <PencilLine
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={otherAnswer}
                  onChange={(event) => setOtherAnswer(event.target.value)}
                  placeholder="Write an answer…"
                  aria-label={`Answer: ${currentQuestion.prompt}`}
                  className="h-10 w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <Button type="submit" variant="primary" size="sm" disabled={!otherAnswer.trim()}>
                {currentIndex === questionSet.questions.length - 1 ? "Send answers" : "Next"}
              </Button>
            </form>
          ) : null}

          {currentIndex > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<ChevronLeft size={14} />}
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
