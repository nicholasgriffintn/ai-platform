import {
  Brain,
  Code,
  HandHelping,
  Laugh,
  Lightbulb,
  SendHorizontal,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "~/components/ui";
import { questionPool } from "~/data-model/sampleQuestions";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useUIStore } from "~/state/stores/uiStore";
import type { Question } from "~/types/sampleQuestions";

function getQuestionIcon(category: string) {
  switch (category) {
    case "creative":
      return (
        <Sparkles size={16} className="mr-2 text-zinc-800 dark:text-zinc-200" />
      );
    case "productivity":
      return (
        <Lightbulb
          size={16}
          className="mr-2 text-zinc-800 dark:text-zinc-200"
        />
      );
    case "technical":
      return (
        <Code size={16} className="mr-2 text-zinc-800 dark:text-zinc-200" />
      );
    case "practical":
      return (
        <HandHelping
          size={16}
          className="mr-2 text-zinc-800 dark:text-zinc-200"
        />
      );
    case "analytical":
      return (
        <Brain size={16} className="mr-2 text-zinc-800 dark:text-zinc-200" />
      );
    case "ethical":
      return (
        <Shield size={16} className="mr-2 text-zinc-800 dark:text-zinc-200" />
      );
    case "humor":
      return (
        <Laugh size={16} className="mr-2 text-zinc-800 dark:text-zinc-200" />
      );
    case "coding":
      return (
        <Code size={16} className="mr-2 text-zinc-800 dark:text-zinc-200" />
      );
    case "challenging":
      return (
        <Zap size={16} className="mr-2 text-orange-600 dark:text-orange-400" />
      );
    default:
      return (
        <SendHorizontal
          size={16}
          className="mr-2 text-zinc-800 dark:text-zinc-200"
        />
      );
  }
}

const baseCategories = [
  "creative",
  "productivity",
  "technical",
  "practical",
  "analytical",
  "ethical",
  "humor",
  "coding",
];

interface SampleQuestionsProps {
  setInput: (text: string) => void;
}

export const SampleQuestions = ({ setInput }: SampleQuestionsProps) => {
  const { trackEvent } = useTrackEvent();

  const { isMobile, isMobileLoading } = useUIStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showChallenging, setShowChallenging] = useState(false);

  const refreshQuestions = useCallback(
    (force = false) => {
      const numQuestions = 4;
      let selected: Question[] = [];

      let selectedCategories: string[] = [];

      if (showChallenging) {
        const challengingQuestions = questionPool.challenging;
        const shuffledQuestions = [...challengingQuestions].sort(
          () => Math.random() - 0.5,
        );
        const selectedQuestions = shuffledQuestions.slice(0, numQuestions);
        selected = selectedQuestions.map((q) => ({
          ...q,
          category: "challenging",
        }));
      } else {
        const shuffledCategories = [...baseCategories].sort(
          () => Math.random() - 0.5,
        );
        selectedCategories = shuffledCategories.slice(0, numQuestions);
        selected = selectedCategories.map((category) => {
          const categoryQuestions = questionPool[category];
          const randomIndex = Math.floor(
            Math.random() * categoryQuestions.length,
          );
          return {
            ...categoryQuestions[randomIndex],
            category,
          };
        });
      }

      if (force) {
        trackEvent({
          name: "refresh_questions",
          category: "conversation",
          properties: {
            action: "refresh",
            count: String(selectedCategories.length),
            challenging_enabled: String(showChallenging),
          },
        });
      }
      setQuestions(selected);
    },
    [trackEvent, showChallenging],
  );

  useEffect(() => {
    refreshQuestions(false);
  }, [showChallenging]);

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
    trackEvent({
      name: "toggle_challenging_questions",
      category: "conversation",
      properties: {
        enabled: String(newValue),
      },
    });
  };

  if (isMobileLoading) {
    return null;
  }

  if (questions.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 max-w-xl mx-auto">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Try asking about...
        </h3>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() => refreshQuestions(true)}
            variant="ghost"
            className="cursor-pointer flex items-center text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          >
            <Sparkles size={14} className="mr-1" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isMobile ? (
          <QuestionOption
            key={questions[0].id}
            questionData={questions[0]}
            onClick={() => handleClick(questions[0])}
          />
        ) : (
          questions.map((q) => (
            <QuestionOption
              key={q.id}
              questionData={q}
              onClick={() => handleClick(q)}
            />
          ))
        )}
      </div>
      <div className="flex items-center justify-end gap-3 w-full mt-3">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showChallenging}
            onChange={handleToggleChallenging}
            className="sr-only"
          />
          <div
            className={`relative inline-block w-8 h-4 rounded-full transition-colors ${
              showChallenging ? "bg-orange-500" : "bg-zinc-300 dark:bg-zinc-600"
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                showChallenging ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </div>
          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Zap
              size={12}
              className="inline mr-1 text-orange-600 dark:text-orange-400"
            />
            Hard
          </span>
        </label>
      </div>
    </div>
  );
};

interface QuestionOptionProps {
  questionData: Question;
  onClick: () => void;
}

const QuestionOption = ({ questionData, onClick }: QuestionOptionProps) => {
  const isChallengingQuestion = questionData.category === "challenging";

  return (
    <Button
      variant="secondary"
      onClick={onClick}
      className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors h-full text-left w-full ${
        isChallengingQuestion
          ? "bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/30 border border-orange-200 dark:border-orange-800"
          : "bg-off-white-highlight dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700"
      }`}
      icon={getQuestionIcon(questionData.category)}
    >
      <span
        className={`text-sm ${
          isChallengingQuestion
            ? "text-orange-800 dark:text-orange-200"
            : "text-zinc-800 dark:text-zinc-200"
        }`}
      >
        {questionData.text}
      </span>
    </Button>
  );
};
