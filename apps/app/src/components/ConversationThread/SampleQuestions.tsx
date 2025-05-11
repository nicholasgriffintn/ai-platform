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
import { useTrackEvent } from "~/hooks/use-track-event";
import { useChatStore } from "~/state/stores/chatStore";

interface Question {
  id: string;
  text: string;
  question: string;
  category: string;
}

type QuestionPool = Record<string, Omit<Question, "category">[]>;

const questionPool: QuestionPool = {
  creative: [
    {
      id: "creative-generate-a-story",
      text: "Generate a story",
      question:
        "Write a short story about a forgotten robot that wakes up in an abandoned theme park.",
    },
    {
      id: "creative-brainstorm-ideas",
      text: "Brainstorm ideas",
      question: "Help me brainstorm creative uses for old wine bottles.",
    },
    {
      id: "creative-design-challenge",
      text: "Design challenge",
      question:
        "How would you design a chair for someone who prefers to work standing up?",
    },
    {
      id: "creative-rewrite-classic",
      text: "Rewrite a Classic",
      question:
        "Reimagine a well-known fairy tale as a modern dystopian story.",
    },
    {
      id: "creative-visual-storytelling",
      text: "Visual Storytelling",
      question:
        "Describe a surreal scene where reality and fantasy blur, using vivid imagery.",
    },
    {
      id: "creative-narrative-ai",
      text: "Narrative AI",
      question:
        "Write a narrative about an AI that becomes self-aware in a society that has abandoned digital technology.",
    },
    {
      id: "creative-character-backstory",
      text: "Character Backstory",
      question:
        "Develop a detailed backstory for a character who is a retired detective solving one final mystery.",
    },
  ],
  productivity: [
    {
      id: "productivity-learning-strategy",
      text: "Learning strategy",
      question:
        "What's the most effective way to learn a new programming language in just 30 minutes a day?",
    },
    {
      id: "productivity-focus-technique",
      text: "Focus technique",
      question:
        "Suggest a technique to maintain focus during long work sessions.",
    },
    {
      id: "productivity-time-management",
      text: "Time management",
      question:
        "How can I structure my day to balance deep work with necessary meetings?",
    },
    {
      id: "productivity-productivity-tools",
      text: "Productivity tools",
      question:
        "What are some productivity tools that can help me stay focused and get things done?",
    },
    {
      id: "productivity-focus-hack",
      text: "Focus Hack",
      question:
        "What are some effective strategies for maintaining focus during long work sessions?",
    },
    {
      id: "productivity-daily-schedule",
      text: "Daily Schedule",
      question:
        "Propose a daily schedule that balances focused deep work with necessary breaks for maximum productivity.",
    },
  ],
  technical: [
    {
      id: "technical-quantum-computing",
      text: "Quantum computing",
      question: "Explain quantum computing as if I'm a 10-year-old.",
    },
    {
      id: "technical-blockchain-basics",
      text: "Blockchain basics",
      question:
        "Explain blockchain technology in simple terms for someone with no technical background.",
    },
    {
      id: "technical-scientific-simplification",
      text: "Scientific Simplification",
      question:
        "Explain a complex scientific concept (like black holes) in simple terms.",
    },
    {
      id: "technical-debugging-challenge",
      text: "Debugging Challenge",
      question:
        "You have a function that's supposed to sort an array of numbers, but it's not working as expected. Can you help debug it?",
    },
    {
      id: "technical-algorithm-design",
      text: "Algorithm Design",
      question:
        "Design an efficient algorithm to find the shortest path in a weighted graph.",
    },
    {
      id: "technical-code-optimization",
      text: "Code Optimization",
      question:
        "How would you optimize a function that calculates the Fibonacci sequence for large inputs?",
    },
  ],
  practical: [
    {
      id: "practical-travel-advice",
      text: "Travel advice",
      question:
        "What's the best approach for planning a trip with friends who have different budgets?",
    },
    {
      id: "practical-cooking-help",
      text: "Cooking help",
      question:
        "What's a simple but impressive dish I could cook for a dinner party?",
    },
    {
      id: "practical-fitness-tips",
      text: "Fitness tips",
      question:
        "Suggest a 15-minute morning workout routine that requires no equipment.",
    },
    {
      id: "practical-diy-life-hack",
      text: "DIY Life Hack",
      question:
        "Suggest a simple DIY project to improve home organization on a budget.",
    },
    {
      id: "practical-diy-innovation",
      text: "DIY Innovation",
      question:
        "Outline a step-by-step plan for repurposing household items to create an organized workspace.",
    },
    {
      id: "practical-coding-best-practices",
      text: "Coding Best Practices",
      question:
        "What are some best practices for writing clean and maintainable code?",
    },
    {
      id: "practical-version-control",
      text: "Version Control",
      question:
        "Explain the basic concepts of version control using Git and provide a simple example of how to use it.",
    },
    {
      id: "practical-testing-strategies",
      text: "Testing Strategies",
      question:
        "What are some effective strategies for testing a web application to ensure it's bug-free?",
    },
  ],
  analytical: [
    {
      id: "analytical-ethical-surveillance",
      text: "Ethical surveillance",
      question:
        "Discuss the potential ethical implications of using AI for personal data surveillance in public spaces.",
    },
    {
      id: "analytical-historical-analysis",
      text: "Historical analysis",
      question:
        "Analyze how the introduction of the telephone might have altered a significant historical event.",
    },
    {
      id: "analytical-automation-effects",
      text: "Automation effects",
      question:
        "Examine the possible consequences of widespread automation on global job markets.",
    },
    {
      id: "analytical-code-review",
      text: "Code Review",
      question:
        "Perform a code review on a sample piece of code and provide feedback on its structure, efficiency, and readability.",
    },
    {
      id: "analytical-performance-analysis",
      text: "Performance Analysis",
      question:
        "Analyze the performance of a given algorithm and suggest improvements to enhance its efficiency.",
    },
    {
      id: "analytical-data-analysis",
      text: "Data Analysis",
      question:
        "Analyze a dataset and provide insights on its trends and patterns.",
    },
    {
      id: "analytical-algorithmic-trading",
      text: "Algorithmic Trading",
      question:
        "Design an algorithmic trading strategy for a given stock and evaluate its potential success.",
    },
  ],
  ethical: [
    {
      id: "ethical-ai-rights",
      text: "AI rights",
      question:
        "Should advanced AI systems be granted certain rights? Provide arguments for and against this idea.",
    },
    {
      id: "ethical-existential-inquiry",
      text: "Existential inquiry",
      question:
        "Reflect on the meaning of life in a future where AI plays a central role in decision-making.",
    },
  ],
  humor: [
    {
      id: "humor-satirical-news",
      text: "Satirical news",
      question:
        "Compose a satirical news article about a fictional breakthrough where robots finally demand 'coffee breaks' in the workplace.",
    },
    {
      id: "humor-witty-commentary",
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
  const trackEvent = useTrackEvent();

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

    trackEvent({
      name: "refresh_questions",
      category: "conversation",
      label: "sample_questions",
      value: 1,
    });

    setQuestions(selected);
  }, [isMobile, trackEvent]);

  useEffect(() => {
    refreshQuestions();
  }, [refreshQuestions]);

  const handleClick = (question: Question) => {
    trackEvent({
      name: "click_question",
      category: "conversation",
      label: "sample_question",
      value: question.id,
    });
    setInput(question.question);
  };

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
        {questions.map((q) => (
          <QuestionOption
            key={q.id}
            questionData={q}
            onClick={() => handleClick(q)}
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
