import { Lightbulb } from "lucide-react";
import { useState } from "react";

import { JsonView } from "../JsonView";
import type { ToolInteractionHandler } from "../registry";

const TOOL_NAME = "ask_user";

interface UserQuestionData {
  question?: string;
  expected_format?: string;
  suggestions?: string[];
  context?: unknown;
  resolved?: boolean;
}

function readQuestionData(data: unknown): UserQuestionData {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  const record = data as UserQuestionData;

  return {
    ...record,
    suggestions: Array.isArray(record.suggestions)
      ? record.suggestions.filter((value): value is string => typeof value === "string")
      : undefined,
  };
}

export function UserQuestionView({
  data,
  onToolInteraction,
}: {
  data: unknown;
  embedded: boolean;
  onToolInteraction?: ToolInteractionHandler;
}) {
  const question = readQuestionData(data);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const isResolved = question.resolved === true || submitted;

  const submit = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed || isResolved || !onToolInteraction) {
      return;
    }

    setSubmitted(true);
    onToolInteraction(TOOL_NAME, "submitPrompt", { answer: trimmed, question: question.question });
  };

  return (
    <section
      data-responsetype="user-question"
      className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/50"
      aria-label="Input required"
    >
      <div className="flex items-start gap-2">
        <Lightbulb
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400"
          aria-hidden="true"
        />
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">Input required</p>
          {question.question && (
            <p className="break-words text-zinc-700 dark:text-zinc-300">{question.question}</p>
          )}
          {question.expected_format && (
            <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
              Expected format: {question.expected_format}
            </p>
          )}
        </div>
      </div>

      {!isResolved && question.suggestions && question.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {question.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => submit(suggestion)}
              className="cursor-pointer rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {question.context != null && (
        <details>
          <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200">
            Additional context
          </summary>
          <div className="mt-1">
            <JsonView data={question.context} />
          </div>
        </details>
      )}

      {isResolved ? (
        <output className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
          Answer sent.
        </output>
      ) : onToolInteraction ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit(answer);
          }}
        >
          <input
            type="text"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Your answer..."
            aria-label="Your answer"
            className="h-8 flex-1 rounded-md border border-zinc-300 bg-transparent px-2.5 text-sm text-zinc-900 outline-none transition-colors focus-visible:border-blue-500 dark:border-zinc-600 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={!answer.trim()}
            className="cursor-pointer rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Send
          </button>
        </form>
      ) : null}
    </section>
  );
}
