import {
  Brain,
  Code,
  HandHelping,
  Laugh,
  Lightbulb,
  SendHorizontal,
  Shield,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "~/components/ui";
import { useChatStore } from "~/state/stores/chatStore";

interface Question {
  text: string;
  question: string;
  category: string;
}

type QuestionPool = Record<string, Omit<Question, "category">[]>;

const questionPool: QuestionPool = {
  creative: [
    {
      text: "Generate a story",
      question:
        "Write a short story about a forgotten robot that wakes up in an abandoned theme park.",
    },
    {
      text: "Brainstorm ideas",
      question: "Help me brainstorm creative uses for old wine bottles.",
    },
    {
      text: "Design challenge",
      question:
        "How would you design a chair for someone who prefers to work standing up?",
    },
    {
      text: "Rewrite a Classic",
      question:
        "Reimagine a well-known fairy tale as a modern dystopian story.",
    },
    {
      text: "Visual Storytelling",
      question:
        "Describe a surreal scene where reality and fantasy blur, using vivid imagery.",
    },
    {
      text: "Narrative AI",
      question:
        "Write a narrative about an AI that becomes self-aware in a society that has abandoned digital technology.",
    },
    {
      text: "Character Backstory",
      question:
        "Develop a detailed backstory for a character who is a retired detective solving one final mystery.",
    },
  ],
  productivity: [
    {
      text: "Learning strategy",
      question:
        "What's the most effective way to learn a new programming language in just 30 minutes a day?",
    },
    {
      text: "Focus technique",
      question:
        "Suggest a technique to maintain focus during long work sessions.",
    },
    {
      text: "Time management",
      question:
        "How can I structure my day to balance deep work with necessary meetings?",
    },
    {
      text: "Productivity tools",
      question:
        "What are some productivity tools that can help me stay focused and get things done?",
    },
    {
      text: "Focus Hack",
      question:
        "What are some effective strategies for maintaining focus during long work sessions?",
    },
    {
      text: "Daily Schedule",
      question:
        "Propose a daily schedule that balances focused deep work with necessary breaks for maximum productivity.",
    },
  ],
  technical: [
    {
      text: "Quantum computing",
      question: "Explain quantum computing as if I'm a 10-year-old.",
    },
    {
      text: "Blockchain basics",
      question:
        "Explain blockchain technology in simple terms for someone with no technical background.",
    },
    {
      text: "Scientific Simplification",
      question:
        "Explain a complex scientific concept (like black holes) in simple terms.",
    },
  ],
  practical: [
    {
      text: "Travel advice",
      question:
        "What's the best approach for planning a trip with friends who have different budgets?",
    },
    {
      text: "Cooking help",
      question:
        "What's a simple but impressive dish I could cook for a dinner party?",
    },
    {
      text: "Fitness tips",
      question:
        "Suggest a 15-minute morning workout routine that requires no equipment.",
    },
    {
      text: "DIY Life Hack",
      question:
        "Suggest a simple DIY project to improve home organization on a budget.",
    },
    {
      text: "DIY Innovation",
      question:
        "Outline a step-by-step plan for repurposing household items to create an organized workspace.",
    },
  ],
  analytical: [
    {
      text: "Ethical surveillance",
      question:
        "Discuss the potential ethical implications of using AI for personal data surveillance in public spaces.",
    },
    {
      text: "Historical analysis",
      question:
        "Analyze how the introduction of the telephone might have altered a significant historical event.",
    },
    {
      text: "Automation effects",
      question:
        "Examine the possible consequences of widespread automation on global job markets.",
    },
  ],
  ethical: [
    {
      text: "AI rights",
      question:
        "Should advanced AI systems be granted certain rights? Provide arguments for and against this idea.",
    },
    {
      text: "Existential inquiry",
      question:
        "Reflect on the meaning of life in a future where AI plays a central role in decision-making.",
    },
  ],
  humor: [
    {
      text: "Satirical news",
      question:
        "Compose a satirical news article about a fictional breakthrough where robots finally demand 'coffee breaks' in the workplace.",
    },
    {
      text: "Witty commentary",
      question:
        "Write a humorous commentary on the evolution of internet memes over the past decade.",
    },
  ],
};

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
    default:
      return (
        <SendHorizontal
          size={16}
          className="mr-2 text-zinc-800 dark:text-zinc-200"
        />
      );
  }
}
const categories = Object.keys(questionPool);

interface SampleQuestionsProps {
  setInput: (text: string) => void;
}

export const SampleQuestions = ({ setInput }: SampleQuestionsProps) => {
  const { isMobile } = useChatStore();

  const [questions, setQuestions] = useState<Question[]>([]);

  const refreshQuestions = useCallback(() => {
    const shuffledCategories = [...categories].sort(() => Math.random() - 0.5);
    const numQuestions = isMobile ? 1 : 4;
    const selectedCategories = shuffledCategories.slice(0, numQuestions);

    const selected = selectedCategories.map((category) => {
      const categoryQuestions = questionPool[category];
      const randomIndex = Math.floor(Math.random() * categoryQuestions.length);
      return {
        ...categoryQuestions[randomIndex],
        category,
      };
    });
    setQuestions(selected);
  }, [isMobile]);

  useEffect(() => {
    refreshQuestions();
  }, [refreshQuestions]);

  return (
    <div className="mt-8 max-w-xl mx-auto">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Try asking about...
        </h3>
        <Button
          type="button"
          onClick={refreshQuestions}
          variant="ghost"
          className="cursor-pointer flex items-center text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
        >
          <Sparkles size={14} className="mr-1" />
          <span>Refresh</span>
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {questions.map((q, index) => (
          <QuestionOption
            key={`${q.text}-${index}`}
            questionData={q}
            onClick={() => setInput(q.question)}
          />
        ))}
      </div>
    </div>
  );
};

interface QuestionOptionProps {
  questionData: Question;
  onClick: () => void;
}

const QuestionOption = ({ questionData, onClick }: QuestionOptionProps) => {
  return (
    <Button
      variant="secondary"
      onClick={onClick}
      className="flex items-center p-3 bg-off-white-highlight dark:bg-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors h-full text-left w-full"
      icon={getQuestionIcon(questionData.category)}
    >
      <span className="text-zinc-800 dark:text-zinc-200 text-sm">
        {questionData.text}
      </span>
    </Button>
  );
};
