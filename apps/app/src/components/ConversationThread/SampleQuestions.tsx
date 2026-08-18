import { SampleQuestionList } from "@ngriffin_uk/polychat-component-conversation";
import { useCallback, useEffect, useState } from "react";

import { useTrackEvent } from "~/hooks/use-track-event";
import { selectSampleQuestions } from "~/lib/sample-questions";
import { useUIStore } from "~/state/stores/uiStore";
import type { Question } from "~/types/sampleQuestions";

interface SampleQuestionsProps {
  setInput: (text: string) => void;
  questionsOverride?: Question[] | null;
  isLoading?: boolean;
}

export const SampleQuestions = ({
  setInput,
  questionsOverride,
  isLoading = false,
}: SampleQuestionsProps) => {
  const { trackEvent } = useTrackEvent();

  const { isMobileLoading } = useUIStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showChallenging, setShowChallenging] = useState(false);
  const displayedQuestions = questionsOverride ?? questions;
  const hasQuestionOverride = questionsOverride !== undefined;

  const refreshQuestions = useCallback(
    (force = false) => {
      const selected = selectSampleQuestions(showChallenging);

      if (force) {
        trackEvent({
          name: "refresh_questions",
          category: "conversation",
          properties: {
            action: "refresh",
            count: String(selected.length),
            challenging_enabled: String(showChallenging),
          },
        });
      }

      setQuestions(selected);
    },
    [trackEvent, showChallenging],
  );

  useEffect(() => {
    if (!hasQuestionOverride && questions.length === 0) {
      setQuestions(selectSampleQuestions(showChallenging));
    }
  }, [hasQuestionOverride, questions.length, showChallenging]);

  const handleClick = (question: Question) => {
    trackEvent({
      name: "click_question",
      category: "conversation",
      properties: {
        question_id: question.id,
        question_category: question.category,
        question_text: question.text,
      },
    });
    setInput(question.question);
  };

  const handleToggleChallenging = () => {
    const newValue = !showChallenging;

    setShowChallenging(newValue);
    setQuestions(selectSampleQuestions(newValue));
    trackEvent({
      name: "toggle_challenging_questions",
      category: "conversation",
      properties: {
        enabled: String(newValue),
      },
    });
  };

  if (questionsOverride === null || displayedQuestions.length === 0) {
    if (hasQuestionOverride) {
      return null;
    }

    return <SampleQuestionList questions={[]} isLoading onSelect={() => undefined} />;
  }

  if (isLoading || isMobileLoading) {
    return <SampleQuestionList questions={[]} isLoading onSelect={() => undefined} />;
  }

  return (
    <SampleQuestionList
      questions={displayedQuestions.map((question) => ({
        id: question.id,
        label: question.text,
        prompt: question.question,
        category: question.category,
      }))}
      showRefresh={!hasQuestionOverride}
      challenging={showChallenging}
      onRefresh={() => refreshQuestions(true)}
      onChallengingChange={hasQuestionOverride ? undefined : handleToggleChallenging}
      onSelect={(selected) => {
        const question = displayedQuestions.find((item) => item.id === selected.id);

        if (question) {
          handleClick(question);
        }
      }}
    />
  );
};
