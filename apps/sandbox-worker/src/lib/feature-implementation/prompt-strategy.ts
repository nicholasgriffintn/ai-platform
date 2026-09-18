import type { SandboxPromptStrategy, SandboxTaskType } from "@ngriffin_uk/polychat-schemas";

type ResolvedPromptStrategy = Exclude<SandboxPromptStrategy, "auto">;

export interface PromptStrategyDefinition {
  strategy: ResolvedPromptStrategy;
  label: string;
}

export interface PromptStrategySelection {
  strategy: ResolvedPromptStrategy;
  definition: PromptStrategyDefinition;
  reason: string;
  source: "explicit" | "task-type" | "task-keywords";
}

const STRATEGY_DEFINITIONS: Record<ResolvedPromptStrategy, PromptStrategyDefinition> = {
  "feature-delivery": {
    strategy: "feature-delivery",
    label: "Feature delivery",
  },
  "bug-fix": {
    strategy: "bug-fix",
    label: "Bug fix",
  },
  refactor: {
    strategy: "refactor",
    label: "Refactor",
  },
  "test-hardening": {
    strategy: "test-hardening",
    label: "Test hardening",
  },
};

const TASK_TYPE_DEFAULT_STRATEGY: Record<SandboxTaskType, ResolvedPromptStrategy> = {
  "feature-implementation": "feature-delivery",
  "code-review": "test-hardening",
  "test-suite": "test-hardening",
  "bug-fix": "bug-fix",
  refactoring: "refactor",
  documentation: "feature-delivery",
  migration: "refactor",
};

const TASK_KEYWORD_STRATEGY_RULES: Array<{
  pattern: RegExp;
  strategy: ResolvedPromptStrategy;
  reason: string;
}> = [
  {
    pattern: /\b(bug|fix|broken|regression|error|defect|crash|failing|hotfix)\b/i,
    strategy: "bug-fix",
    reason: "Task text indicates bug-fixing work.",
  },
  {
    pattern: /\b(refactor|cleanup|restructure|rename|debt|simplify)\b/i,
    strategy: "refactor",
    reason: "Task text indicates maintainability-focused refactoring.",
  },
  {
    pattern: /\b(test|coverage|spec|assertion|integration test|regression test)\b/i,
    strategy: "test-hardening",
    reason: "Task text indicates testing and verification focus.",
  },
];

function isResolvedPromptStrategy(value: string): value is ResolvedPromptStrategy {
  return value in STRATEGY_DEFINITIONS;
}

function fromTaskKeywords(task: string): PromptStrategySelection | null {
  const trimmedTask = task.trim();

  if (!trimmedTask) {
    return null;
  }

  for (const rule of TASK_KEYWORD_STRATEGY_RULES) {
    if (!rule.pattern.test(trimmedTask)) {
      continue;
    }

    const definition = STRATEGY_DEFINITIONS[rule.strategy];

    return {
      strategy: rule.strategy,
      definition,
      reason: rule.reason,
      source: "task-keywords",
    };
  }

  return null;
}

export function resolvePromptStrategy(params: {
  requestedStrategy?: SandboxPromptStrategy;
  taskType: SandboxTaskType;
  task: string;
}): PromptStrategySelection {
  const { requestedStrategy, taskType, task } = params;

  if (requestedStrategy && requestedStrategy !== "auto") {
    if (isResolvedPromptStrategy(requestedStrategy)) {
      return {
        strategy: requestedStrategy,
        definition: STRATEGY_DEFINITIONS[requestedStrategy],
        reason: `Using explicit strategy '${requestedStrategy}'.`,
        source: "explicit",
      };
    }
  }

  const byKeywords = fromTaskKeywords(task);

  if (byKeywords) {
    return byKeywords;
  }

  const defaultStrategy = TASK_TYPE_DEFAULT_STRATEGY[taskType];

  return {
    strategy: defaultStrategy,
    definition: STRATEGY_DEFINITIONS[defaultStrategy],
    reason: `Using default strategy for task type '${taskType}'.`,
    source: "task-type",
  };
}
