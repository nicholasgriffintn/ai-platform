import { questionPool } from "~/data-model/sampleQuestions";
import type { Question } from "~/types/sampleQuestions";

const DEFAULT_QUESTION_COUNT = 4;
const QUESTION_CATEGORIES = [
  "creative",
  "productivity",
  "technical",
  "practical",
  "analytical",
  "ethical",
  "humor",
  "coding",
];

export function selectSampleQuestions(
  showChallenging: boolean,
  random: () => number = Math.random,
): Question[] {
  if (showChallenging) {
    return [...questionPool.challenging]
      .sort(() => random() - 0.5)
      .slice(0, DEFAULT_QUESTION_COUNT)
      .map((question) => ({ ...question, category: "challenging" }));
  }

  return [...QUESTION_CATEGORIES]
    .sort(() => random() - 0.5)
    .slice(0, DEFAULT_QUESTION_COUNT)
    .map((category) => {
      const categoryQuestions = questionPool[category];
      const randomIndex = Math.floor(random() * categoryQuestions.length);

      return { ...categoryQuestions[randomIndex], category };
    });
}
