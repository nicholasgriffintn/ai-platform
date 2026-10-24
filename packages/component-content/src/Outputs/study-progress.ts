import type { StudyProgress } from "@ngriffin_uk/polychat-schemas";

export const EMPTY_STUDY_PROGRESS: StudyProgress = { known: [], missed: [], answers: {} };

export function markFlashcard(
  progress: StudyProgress,
  index: number,
  mark: "known" | "missed",
): StudyProgress {
  const other = mark === "known" ? "missed" : "known";

  return {
    ...progress,
    [mark]: [...new Set([...progress[mark], index])],
    [other]: progress[other].filter((value) => value !== index),
  };
}

export function answerQuizQuestion(
  progress: StudyProgress,
  index: number,
  optionIndex: number,
): StudyProgress {
  return { ...progress, answers: { ...progress.answers, [String(index)]: optionIndex } };
}

export function scoreQuiz(
  answers: StudyProgress["answers"],
  questions: readonly { answerIndex: number }[],
): number {
  return questions.filter((question, index) => answers[String(index)] === question.answerIndex)
    .length;
}
