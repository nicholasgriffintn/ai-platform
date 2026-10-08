import { useRef, useState } from "react";

import { formatQuestionAnswers } from "../../utils/question-answers";
import type { ToolInteractionHandler } from "../registry";
import type { UserQuestionAnswer, UserQuestionSet } from "./userQuestionData";

const TOOL_NAME = "ask_user";

export function useUserQuestionSubmission(
  questionSet: UserQuestionSet | null,
  onToolInteraction?: ToolInteractionHandler,
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<UserQuestionAnswer[]>([]);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [otherAnswer, setOtherAnswer] = useState("");
  const [submission, setSubmission] = useState<{
    interactionId: string;
    status: "submitting" | "acknowledged" | "failed";
  } | null>(null);
  const submittingRef = useRef(false);

  const submissionStatus =
    submission && submission.interactionId === questionSet?.interactionId
      ? submission.status
      : null;
  const isSubmitting = submissionStatus === "submitting";
  const isResolved = questionSet?.resolved || submissionStatus === "acknowledged";
  const currentQuestion = questionSet?.questions[currentIndex];
  const answerCurrent = async (answer: string, attachedFiles: File[] = []) => {
    const trimmed = answer.trim();

    if (
      !questionSet ||
      !trimmed ||
      !currentQuestion ||
      isResolved ||
      submittingRef.current ||
      !onToolInteraction
    ) {
      return;
    }

    const nextAnswers = [
      ...answers.filter((item) => item.questionId !== currentQuestion.id),
      { questionId: currentQuestion.id, answer: trimmed },
    ];

    const nextFiles = { ...files, [currentQuestion.id]: attachedFiles };

    setAnswers(nextAnswers);
    setFiles(nextFiles);

    if (currentIndex < questionSet.questions.length - 1) {
      setOtherAnswer("");
      setCurrentIndex(currentIndex + 1);

      return;
    }

    const interactionId = questionSet.interactionId;

    submittingRef.current = true;
    setSubmission({ interactionId, status: "submitting" });
    try {
      await onToolInteraction(TOOL_NAME, "submitPrompt", {
        interactionId,
        answers: nextAnswers,
        input: formatQuestionAnswers(nextAnswers),
        files: nextAnswers.flatMap((item) => nextFiles[item.questionId] ?? []),
      });
      setSubmission({ interactionId, status: "acknowledged" });
    } catch {
      setSubmission({ interactionId, status: "failed" });
    } finally {
      submittingRef.current = false;
    }
  };

  return {
    answerCurrent,
    currentIndex,
    currentQuestion,
    isResolved,
    isSubmitting,
    otherAnswer,
    setCurrentIndex,
    setOtherAnswer,
    submissionStatus,
  };
}
