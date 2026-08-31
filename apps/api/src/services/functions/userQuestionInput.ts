import { USER_QUESTION_MAX_OPTIONS } from "@ngriffin_uk/polychat-schemas";

import { isRecord } from "~/utils/objects";

const QUESTION_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

interface NormalisedQuestionOption {
  label: string;
  description?: string;
}

interface NormalisedQuestion {
  id: string;
  prompt: string;
  options: NormalisedQuestionOption[];
  allowOther: boolean;
}

function questionId(value: unknown, prompt: string, index: number): string {
  if (typeof value === "string" && QUESTION_ID_PATTERN.test(value) && value.length <= 60) {
    return value;
  }

  const fromPrompt = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return fromPrompt || `question-${index + 1}`;
}

function normaliseOption(value: unknown): NormalisedQuestionOption | null {
  if (typeof value === "string" && value.trim()) {
    return { label: value.trim() };
  }

  if (!isRecord(value)) {
    return null;
  }

  const label =
    typeof value.label === "string"
      ? value.label.trim()
      : typeof value.value === "string"
        ? value.value.trim()
        : "";

  if (!label) {
    return null;
  }

  return typeof value.description === "string"
    ? { label, description: value.description.trim() }
    : { label };
}

function normaliseQuestion(value: unknown, index: number): NormalisedQuestion | null {
  const candidate = typeof value === "string" ? { question: value } : value;

  if (!isRecord(candidate)) {
    return null;
  }

  const prompt =
    typeof candidate.prompt === "string"
      ? candidate.prompt.trim()
      : typeof candidate.question === "string"
        ? candidate.question.trim()
        : typeof candidate.message === "string"
          ? candidate.message.trim()
          : "";

  if (!prompt) {
    return null;
  }

  const candidateOptions = Array.isArray(candidate.options)
    ? candidate.options
    : Array.isArray(candidate.choices)
      ? candidate.choices
      : [];
  const options = candidateOptions
    .flatMap((option) => {
      const normalised = normaliseOption(option);

      return normalised ? [normalised] : [];
    })
    .slice(0, USER_QUESTION_MAX_OPTIONS);

  return {
    id: questionId(candidate.id, prompt, index),
    prompt,
    options,
    allowOther:
      typeof candidate.allowOther === "boolean"
        ? candidate.allowOther
        : typeof candidate.allow_custom === "boolean"
          ? candidate.allow_custom
          : true,
  };
}

export function normaliseAskUserInput(input: unknown): unknown {
  if (!isRecord(input)) {
    return input;
  }

  const questions = Array.isArray(input.questions)
    ? input.questions
    : typeof input.question === "string"
      ? [input]
      : typeof input.message === "string"
        ? [input]
        : null;

  if (!questions) {
    return input;
  }

  const normalised = questions.map(normaliseQuestion);

  return normalised.every((question): question is NormalisedQuestion => question !== null)
    ? { questions: normalised }
    : input;
}
