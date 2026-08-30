export interface UserQuestionAnswer {
  questionId: string;
  answer: string;
}

export interface UserQuestionOption {
  label: string;
  description: string | null;
}

export interface UserQuestion {
  id: string;
  prompt: string;
  options: UserQuestionOption[];
  allowOther: boolean;
}

export interface UserQuestionSet {
  interactionId: string;
  questions: UserQuestion[];
  requestedAt: string;
  resolved: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readOption(value: unknown): UserQuestionOption | null {
  if (!isRecord(value) || typeof value.label !== "string" || !value.label.trim()) {
    return null;
  }

  return {
    label: value.label,
    description: typeof value.description === "string" ? value.description : null,
  };
}

function readQuestion(value: unknown): UserQuestion | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.prompt !== "string" ||
    !value.prompt.trim()
  ) {
    return null;
  }

  return {
    id: value.id,
    prompt: value.prompt,
    options: Array.isArray(value.options)
      ? value.options
          .map(readOption)
          .filter((option): option is UserQuestionOption => option !== null)
      : [],
    allowOther: value.allowOther !== false,
  };
}

export function readUserQuestionSet(data: unknown): UserQuestionSet | null {
  if (!isRecord(data) || typeof data.interactionId !== "string" || !Array.isArray(data.questions)) {
    return null;
  }

  const questions = data.questions
    .map(readQuestion)
    .filter((question): question is UserQuestion => question !== null);

  if (questions.length === 0 || questions.length !== data.questions.length) {
    return null;
  }

  return {
    interactionId: data.interactionId,
    questions,
    requestedAt: typeof data.requestedAt === "string" ? data.requestedAt : "",
    resolved: data.resolved === true,
  };
}
