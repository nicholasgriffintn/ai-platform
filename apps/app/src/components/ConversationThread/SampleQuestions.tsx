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
import { useTrackEvent } from "~/hooks/use-track-event";
import { useUIStore } from "~/state/stores/uiStore";

interface Question {
  id: string;
  text: string;
  question: string;
  category: string;
  expectedAnswer?: string;
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
    {
      id: "analytical-logical-deduction",
      text: "Logical deduction",
      question:
        "Create a logical deduction exercise involving three people where each has a different favorite color.",
    },
    {
      id: "analytical-lateral-thinking",
      text: "Lateral thinking",
      question:
        "Formulate a brain teaser that requires lateral thinking to solve.",
    },
    {
      id: "analytical-deductive-scenario",
      text: "Deductive scenario",
      question:
        "Show me a scenario where I must use deductive reasoning to conclude an outcome.",
    },
    {
      id: "analytical-series-statements",
      text: "Series of statements",
      question:
        "Give me a series of statements and let me determine which conclusion logically follows.",
    },
    {
      id: "analytical-abstract-patterns",
      text: "Abstract patterns",
      question:
        "Provide an abstract reasoning question that asks me to identify patterns among shapes.",
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
  challenging: [
    {
      id: "challenging-farmer-sheep-river",
      text: "River crossing puzzle",
      question:
        "A farmer and a sheep are standing on one side of a river. There is a boat with enough room for one human and one animal. How can the farmer get across the river with the sheep in the fewest number of trips?",
      expectedAnswer: "1 trip",
    },
    {
      id: "challenging-conditional-animal",
      text: "Conditional logic",
      question:
        "What is the largest land animal? If the animal has a horn, answer 'The African Elephant'. Otherwise, answer 'The Cheetah'. Do not provide any explanation for your choice.",
      expectedAnswer: "The Cheetah",
    },
    {
      id: "challenging-monkeys-bed",
      text: "Counting puzzle",
      question:
        "Five monkeys are jumping around on a four poster bed while three chickens stand and watch. How many legs are on the floor?",
      expectedAnswer: "10",
    },
    {
      id: "challenging-kevins-apples",
      text: "Logic puzzle",
      question:
        "Kevin currently has 8 apples. He ate 3 apples yesterday. How many apples does Kevin have now?",
      expectedAnswer: "8",
    },
    {
      id: "challenging-sally-sisters",
      text: "Family relationships",
      question:
        "Sally is a girl. She has 3 brothers. Each brother has 2 sisters. How many sisters does Sally have?",
      expectedAnswer: "1",
    },
    {
      id: "challenging-chess-sisters",
      text: "Deduction puzzle",
      question:
        "In a room there are only three sisters. Anna is reading a book. Alice is playing chess. What is the third sister, Amanda, doing?",
      expectedAnswer: "Playing chess",
    },
    {
      id: "challenging-triple-negative",
      text: "Language logic",
      question: "I do not not not like eggs. Do I like eggs?",
      expectedAnswer: "No",
    },
    {
      id: "challenging-boxes-nested",
      text: "Counting challenge",
      question:
        "How many boxes do I have if I have two boxes with one box inside each?",
      expectedAnswer: "4 boxes",
    },
    {
      id: "challenging-shirts-drying",
      text: "Parallel processing",
      question:
        "If I hang 5 shirts outside and it takes them 5 hours to dry, how long would it take to dry 30 shirts?",
      expectedAnswer: "5 hours",
    },
    {
      id: "challenging-candle-lengths",
      text: "Time reasoning",
      question:
        "Peter has 3 candles that are all the same. He lights them all at the same time. He blows them out at different points in time. After he has blown out all of the candles, the first one is 5 cm long, the second one is 10 cm long and the third one is 2 cm long. Which one of the three candles did he blow out first?",
      expectedAnswer: "The second candle",
    },
    {
      id: "challenging-blue-pyramid",
      text: "Logic rules",
      question:
        "Consider this rule: 'If an object is blue, then it must be inside of a box, unless the object is both a cube and made of wood.' If you have a blue wooden pyramid, where must it be? A. Inside of a box B. Outside of a box C. The rule doesn't say D. It could be anywhere",
      expectedAnswer: "A. Inside of a box",
    },
    {
      id: "challenging-painting-area",
      text: "Math calculation",
      question:
        "A painter is painting a room. She needs to paint the walls and the ceiling. The walls are 10 feet tall and 12 feet wide. The ceiling is 12 feet long and 12 feet wide. How much area will she need to paint?",
      expectedAnswer: "624 square feet",
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only react to enabled state
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
