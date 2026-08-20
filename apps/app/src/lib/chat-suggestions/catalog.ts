import type { FocusRole } from "~/lib/focus-role";

import type { ChatSuggestionContext, ChatSuggestionDefinition } from "./types";

export const CAPABILITY_SUGGESTIONS: ChatSuggestionDefinition[] = [
  {
    id: "capability-council",
    label: "Let a council argue it out",
    prompt:
      "Convene a council on a decision I'm weighing up. Ask me what it is, then let them disagree properly before they converge.",
    category: "council",
    hint: "Turns on the council for this message",
    action: { type: "tool", toolIds: ["run_council", "select_council_members"] },
    isEligible: (context) => context.availableToolIds.includes("run_council"),
  },
  {
    id: "capability-live",
    label: "Talk it through out loud",
    category: "live",
    hint: "Switches to Live mode",
    action: { type: "mode", modeId: "live" },
    isEligible: (context) => context.availableModes.includes("live"),
  },
  {
    id: "capability-background",
    label: "Set something running",
    category: "background",
    hint: "Switches to Background mode",
    action: { type: "mode", modeId: "background" },
    isEligible: (context) => context.availableModes.includes("background"),
  },
  {
    id: "capability-image",
    label: "Make an image",
    prompt:
      "Make an image of a rain-streaked London window, with a parrot inside reading the paper.",
    category: "image",
    hint: "Turns on image generation for this message",
    action: { type: "tool", toolIds: ["create_image"] },
    isEligible: (context) => context.availableToolIds.includes("create_image"),
  },
  {
    id: "capability-research",
    label: "Look something up properly",
    prompt:
      "Ask me what I want researched, then find current sources and tell me what they agree on and where they don't.",
    category: "research",
    action: { type: "tool", toolIds: ["web_search"] },
    isEligible: (context) => context.availableToolIds.includes("web_search"),
  },
];

interface ConnectorSuggestionCopy {
  label: string;
  prompt: string;
}

const CONNECTOR_SUGGESTIONS: Record<string, ConnectorSuggestionCopy> = {
  asana: {
    label: "Look at my tasks",
    prompt: "Look at my tasks and tell me what I'm realistically going to finish today.",
  },
  github: {
    label: "Check my pull requests",
    prompt: "Look at my open pull requests and tell me which ones are waiting on me.",
  },
  gmail: {
    label: "Sort out my inbox",
    prompt: "Go through my unread mail and tell me what actually needs me today.",
  },
  googlecalendar: {
    label: "Look at my week",
    prompt:
      "Look at my calendar for the next seven days and tell me where it's going to get tight.",
  },
  jira: {
    label: "Check what's open",
    prompt: "Look at my open issues and tell me which one is quietly blocking the others.",
  },
  linear: {
    label: "Check what's open",
    prompt: "Look at my open issues and tell me which one is quietly blocking the others.",
  },
  notion: {
    label: "Find it in Notion",
    prompt: "Search my Notion for anything I left unfinished and tell me what's worth picking up.",
  },
  outlook: {
    label: "Sort out my inbox",
    prompt: "Go through my unread mail and tell me what actually needs me today.",
  },
  slack: {
    label: "Catch up on Slack",
    prompt: "Go through what I've missed on Slack and tell me what needs a reply.",
  },
  todoist: {
    label: "Look at my tasks",
    prompt: "Look at my tasks and tell me what I'm realistically going to finish today.",
  },
};

export function buildConnectorSuggestions(
  context: ChatSuggestionContext,
): ChatSuggestionDefinition[] {
  return context.connectors.map((connector) => {
    const copy = CONNECTOR_SUGGESTIONS[connector.id] ?? {
      label: `Put ${connector.name} to work`,
      prompt: `Have a look at my ${connector.name} and tell me what needs attention.`,
    };

    return {
      id: `connector-${connector.id}`,
      label: copy.label,
      prompt: copy.prompt,
      category: "connector",
      hint: `Uses your ${connector.name} connection`,
    };
  });
}

export function buildRecipeSuggestions(context: ChatSuggestionContext): ChatSuggestionDefinition[] {
  return context.recipes.map((recipe) => ({
    id: `recipe-${recipe.id}`,
    label: recipe.title,
    prompt: `Run my ${recipe.title} recipe.`,
    category: "recipe",
    hint: "Runs one of your installed recipes",
  }));
}

export const FOCUS_SUGGESTIONS: Record<FocusRole, ChatSuggestionDefinition[]> = {
  engineering: [
    {
      id: "focus-engineering-review",
      label: "Review a tricky change",
      prompt:
        "Review the change I'm about to paste for correctness, edge cases, and the failure nobody has thought about yet.",
      category: "engineering",
    },
    {
      id: "focus-engineering-orient",
      label: "Explain an unfamiliar codebase",
      prompt:
        "Ask me for a file or a repository, then explain how the thing actually fits together rather than what each function does.",
      category: "engineering",
    },
    {
      id: "focus-engineering-architecture",
      label: "Talk through an architecture call",
      prompt:
        "Help me choose between two designs. Argue both sides properly before you recommend one.",
      category: "engineering",
    },
  ],
  design: [
    {
      id: "focus-design-sharpen",
      label: "Sharpen a rough concept",
      prompt:
        "I'll describe a design I keep circling. Push back on it, then suggest three directions I haven't considered.",
      category: "design",
    },
    {
      id: "focus-design-interface",
      label: "Pull apart an interface",
      prompt:
        "Ask me for a screen or a flow, then tell me what's doing too much work and what could go entirely.",
      category: "design",
    },
    {
      id: "focus-design-naming",
      label: "Name the thing properly",
      prompt:
        "Help me name something. Ask what it does first, then give me options with the reasoning behind each.",
      category: "design",
    },
  ],
  leadership: [
    {
      id: "focus-leadership-decision",
      label: "Give a decision a clearer shape",
      prompt:
        "Help me structure a decision I'm stuck on. Ask what the constraints are before offering anything.",
      category: "leadership",
    },
    {
      id: "focus-leadership-plan",
      label: "Pressure-test a plan",
      prompt: "I'll outline a plan. Find where it quietly assumes everything will go well.",
      category: "leadership",
    },
    {
      id: "focus-leadership-message",
      label: "Write the awkward message",
      prompt:
        "Help me write a message I've been putting off. Ask who it's for and what has to land.",
      category: "leadership",
    },
  ],
  writing: [
    {
      id: "focus-writing-paragraph",
      label: "Fix a paragraph that won't sit",
      prompt: "I'll paste a paragraph that isn't working. Tell me why before you rewrite it.",
      category: "writing",
    },
    {
      id: "focus-writing-angle",
      label: "Find a different angle",
      prompt:
        "Ask me what I'm writing about, then suggest three angles that aren't the obvious one.",
      category: "writing",
    },
    {
      id: "focus-writing-cut",
      label: "Cut it down without losing it",
      prompt: "Take what I paste next and make it shorter while keeping what actually matters.",
      category: "writing",
    },
  ],
  research: [
    {
      id: "focus-research-question",
      label: "Follow a question properly",
      prompt:
        "Ask me the question I'm chasing, then map out what's settled, what's contested, and what nobody has answered.",
      category: "research",
    },
    {
      id: "focus-research-reasoning",
      label: "Check my reasoning",
      prompt: "I'll lay out an argument. Find the step that's doing more work than it should.",
      category: "research",
    },
    {
      id: "focus-research-paper",
      label: "Summarise a paper honestly",
      prompt:
        "Ask me for a paper, then summarise it including the limitations the abstract glossed over.",
      category: "research",
    },
  ],
  education: [
    {
      id: "focus-education-explain",
      label: "Explain it a level down",
      prompt:
        "Ask me what I'm stuck on, then explain it starting from the point where I stopped following.",
      category: "education",
    },
    {
      id: "focus-education-quiz",
      label: "Test me on it",
      prompt: "Ask me a subject, then quiz me on it and tell me where my understanding is thin.",
      category: "education",
    },
    {
      id: "focus-education-plan",
      label: "Plan the next fortnight",
      prompt:
        "Help me plan how to learn something, given the time I actually have. Ask how much that is.",
      category: "education",
    },
  ],
};

export const EVERYDAY_SUGGESTIONS: ChatSuggestionDefinition[] = [
  {
    id: "everyday-decision",
    label: "Think through a decision",
    prompt:
      "Help me weigh up a decision I keep going back and forth on. Ask what the options are first.",
    category: "everyday",
  },
  {
    id: "everyday-explain",
    label: "Explain something properly",
    prompt:
      "Ask me what I want explained, then explain it without skipping the part that's actually confusing.",
    category: "everyday",
  },
  {
    id: "everyday-message",
    label: "Draft an awkward message",
    prompt: "Help me write a message I've been avoiding. Ask who it's for and what needs to land.",
    category: "everyday",
  },
  {
    id: "everyday-plan",
    label: "Plan something realistic",
    prompt: "Help me plan something, then tell me which part of the plan will slip first.",
    category: "everyday",
  },
  {
    id: "everyday-argue",
    label: "Argue against me",
    prompt: "I'll give you a position I hold. Make the strongest case against it.",
    category: "everyday",
  },
  {
    id: "everyday-untangle",
    label: "Make sense of a mess",
    prompt: "I'll paste something disorganised. Turn it into something with a shape.",
    category: "everyday",
  },
  {
    id: "everyday-question",
    label: "Find the better question",
    prompt:
      "Ask me what I'm trying to work out, then tell me whether I'm asking the wrong question.",
    category: "everyday",
  },
  {
    id: "everyday-start",
    label: "Start something new",
    prompt:
      "Ask me what I want to make, then help me get the first version out rather than the perfect one.",
    category: "everyday",
  },
];
