export interface ChatWelcome {
  title: string;
  description: string;
}

export interface ChatWelcomeContext {
  preferredName?: string | null;
  accountName?: string | null;
  jobRole?: string | null;
  hasPreviousChats: boolean;
}

type WelcomeTemplate = (name: string) => ChatWelcome;

const GENERIC_WELCOMES: ChatWelcome[] = [
  {
    title: "What’s on your mind?",
    description: "Bring a question, a rough idea, or something you want to work through.",
  },
  {
    title: "What deserves a closer look?",
    description: "Start with the messy version. We can work from there.",
  },
  {
    title: "Shall we make a little trouble?",
    description:
      "The constructive kind: test an idea, challenge an assumption, or make something new.",
  },
  {
    title: "Heard anything good lately?",
    description: "Repeat it here. We’ll see what it turns into.",
  },
];

const RETURNING_WELCOMES: ChatWelcome[] = [
  {
    title: "What’s still buzzing?",
    description: "A problem, a possibility, or the thought that wouldn’t leave.",
  },
  {
    title: "Where to next?",
    description: "Pick up a thread, or start an unrelated one.",
  },
  {
    title: "What should we work through?",
    description: "Continue where you left off, or start somewhere new.",
  },
  {
    title: "Back so soon?",
    description: "Good. The perch was getting quiet.",
  },
];

const NAMED_NEW_WELCOMES: WelcomeTemplate[] = [
  (name) => ({
    title: `A blank page, ${name}.`,
    description: "Bring a question, a rough idea, or anything you want to work through.",
  }),
  (name) => ({
    title: `Where should we start, ${name}?`,
    description: "Start with the unfinished version. We can shape it from there.",
  }),
  (name) => ({
    title: `What are you curious about, ${name}?`,
    description: "A practical question, a new idea, or anything in between.",
  }),
];

const NAMED_RETURNING_WELCOMES: WelcomeTemplate[] = [
  (name) => ({
    title: `Where to next, ${name}?`,
    description: "Pick up a thread, or start an unrelated one.",
  }),
  (name) => ({
    title: `What’s still buzzing, ${name}?`,
    description: "Bring the problem, the possibility, or the thought that wouldn’t leave.",
  }),
  (name) => ({
    title: `What should we pick up, ${name}?`,
    description: "Continue where you left off, or start somewhere new.",
  }),
];

const FOCUS_WELCOME_WEIGHT = 0.6;

const FOCUS_WELCOMES: Array<{
  keywords: string[];
  template: WelcomeTemplate;
}> = [
  {
    keywords: ["engineer", "developer", "software", "technical", "programmer"],
    template: (name) => ({
      title: `What are we taking apart, ${name}?`,
      description: "Code knot, system puzzle, or the suspiciously simple thing that isn’t.",
    }),
  },
  {
    keywords: ["design", "creative", "artist", "illustrator"],
    template: (name) => ({
      title: `What are we sketching, ${name}?`,
      description: "A rough concept, a tricky detail, or the version before the polished one.",
    }),
  },
  {
    keywords: ["manager", "founder", "leader", "product", "director", "executive"],
    template: (name) => ({
      title: `What needs a clearer shape, ${name}?`,
      description: "A decision, a knotty trade-off, or a plan still finding its feet.",
    }),
  },
  {
    keywords: ["writer", "editor", "content", "marketing", "communications"],
    template: (name) => ({
      title: `What are we untangling, ${name}?`,
      description: "A stubborn sentence, a fresh angle, or an idea that needs a voice.",
    }),
  },
  {
    keywords: ["research", "scientist", "analyst", "academic"],
    template: (name) => ({
      title: `Which question are we following, ${name}?`,
      description: "Bring the evidence, the gap, or the question behind the question.",
    }),
  },
  {
    keywords: ["student", "teacher", "educator"],
    template: (name) => ({
      title: `What are we working through, ${name}?`,
      description: "An essay, a difficult concept, or the next step in an assignment.",
    }),
  },
];

function getDisplayName({ preferredName, accountName }: ChatWelcomeContext): string | null {
  const nickname = preferredName?.trim();

  if (nickname) {
    return nickname.slice(0, 32);
  }

  const firstName = accountName?.trim().split(/\s+/)[0];

  return firstName ? firstName.slice(0, 32) : null;
}

function getFocusWelcome(jobRole: string | null | undefined, name: string): ChatWelcome | null {
  const normalisedRole = jobRole?.trim().toLocaleLowerCase();

  if (!normalisedRole) {
    return null;
  }

  const match = FOCUS_WELCOMES.find(({ keywords }) =>
    keywords.some((keyword) => normalisedRole.includes(keyword)),
  );

  return match
    ? match.template(name)
    : {
        title: `What are we working on, ${name}?`,
        description: "Bring the tricky bit from work, or anything else on your mind.",
      };
}

function boundRandomValue(randomValue: number): number {
  return Number.isFinite(randomValue) ? Math.min(Math.max(randomValue, 0), 0.999999999) : 0;
}

function selectWelcome(welcomes: ChatWelcome[], randomValue: number): ChatWelcome {
  const boundedRandom = boundRandomValue(randomValue);

  return welcomes[Math.floor(boundedRandom * welcomes.length)];
}

export function createChatWelcome(context: ChatWelcomeContext, randomValue: number): ChatWelcome {
  const name = getDisplayName(context);

  if (name) {
    const templates = context.hasPreviousChats ? NAMED_RETURNING_WELCOMES : NAMED_NEW_WELCOMES;
    const welcomes = templates.map((template) => template(name));
    const focusWelcome = getFocusWelcome(context.jobRole, name);

    if (!focusWelcome) {
      return selectWelcome(welcomes, randomValue);
    }

    const boundedRandom = boundRandomValue(randomValue);

    if (boundedRandom < FOCUS_WELCOME_WEIGHT) {
      return focusWelcome;
    }

    const varietyRandom = (boundedRandom - FOCUS_WELCOME_WEIGHT) / (1 - FOCUS_WELCOME_WEIGHT);

    return selectWelcome(welcomes, varietyRandom);
  }

  return selectWelcome(
    context.hasPreviousChats ? RETURNING_WELCOMES : GENERIC_WELCOMES,
    randomValue,
  );
}
