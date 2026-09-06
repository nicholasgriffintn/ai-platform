export function formatQuestionAnswers(
  answers: readonly { questionId: string; answer: string }[],
): string {
  return answers.map(({ questionId, answer }) => `${questionId}: ${answer}`).join("\n");
}
