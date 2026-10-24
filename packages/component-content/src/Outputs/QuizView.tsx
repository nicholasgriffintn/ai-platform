import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import type { QuizOutputContent, StudyProgress } from "@ngriffin_uk/polychat-schemas";
import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { answerQuizQuestion, EMPTY_STUDY_PROGRESS, scoreQuiz } from "./study-progress";

export interface QuizViewProps {
  content: QuizOutputContent;
  progress?: StudyProgress;
  onProgressChange?: (progress: StudyProgress) => void;
}

export function QuizView({ content, progress: savedProgress, onProgressChange }: QuizViewProps) {
  const [localProgress, setLocalProgress] = useState(EMPTY_STUDY_PROGRESS);
  const progress = savedProgress ?? localProgress;
  const answered = Object.keys(progress.answers).length;
  const score = scoreQuiz(progress.answers, content.questions);
  const update = (next: StudyProgress) => {
    setLocalProgress(next);
    onProgressChange?.(next);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular-nums">
          {answered === content.questions.length
            ? `${score} of ${content.questions.length} right`
            : `${answered} of ${content.questions.length} answered`}
        </span>
        <Button
          variant="outline"
          size="sm"
          icon={<RotateCcw className="size-4" />}
          disabled={answered === 0}
          onClick={() => update({ ...progress, answers: {} })}
        >
          Start again
        </Button>
      </div>
      <ol className="flex flex-col gap-6">
        {content.questions.map((question, index) => {
          const chosen = progress.answers[String(index)];
          const isAnswered = chosen !== undefined;

          return (
            <li key={question.question} className="flex flex-col gap-3">
              <p className="font-medium text-foreground">
                <span className="mr-2 text-muted-foreground tabular-nums">{index + 1}.</span>
                {question.question}
              </p>
              <div className="flex flex-col gap-2" role="radiogroup" aria-label={question.question}>
                {question.options.map((option, optionIndex) => {
                  const isRight = optionIndex === question.answerIndex;
                  const isChosen = optionIndex === chosen;

                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={isChosen}
                      disabled={isAnswered}
                      onClick={() => update(answerQuizQuestion(progress, index, optionIndex))}
                      className={cn(
                        "cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default",
                        !isAnswered && "border-border hover:border-foreground/40",
                        isAnswered && isRight && "border-success/60 bg-success/10",
                        isAnswered && isChosen && !isRight && "border-failure/60 bg-failure/10",
                        isAnswered && !isChosen && !isRight && "border-border opacity-60",
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {isAnswered ? (
                <p className="text-sm text-muted-foreground">
                  <span
                    className={cn(
                      "font-medium",
                      chosen === question.answerIndex ? "text-success" : "text-failure",
                    )}
                  >
                    {chosen === question.answerIndex ? "Right. " : "Not quite. "}
                  </span>
                  {question.explanation}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
