import type { PromptModelMetadata } from "./sections/metadata";

export interface PromptCapabilities {
  supportsToolCalls: boolean;
  supportsArtifacts: boolean;
  supportsReasoning: boolean;
  requiresThinkingPrompt: boolean;
}

interface ResolvePromptCapabilityArgs {
  supportsToolCalls?: boolean;
  supportsArtifacts?: boolean;
  supportsReasoning?: boolean;
  requiresThinkingPrompt?: boolean;
  modelMetadata?: PromptModelMetadata;
}

export function resolvePromptCapabilities({
  supportsToolCalls,
  supportsArtifacts,
  supportsReasoning,
  requiresThinkingPrompt,
  modelMetadata,
}: ResolvePromptCapabilityArgs): PromptCapabilities {
  const metadata = modelMetadata?.modelConfig;

  return {
    supportsToolCalls:
      supportsToolCalls ?? metadata?.supportsToolCalls ?? false,
    supportsArtifacts:
      supportsArtifacts ?? metadata?.supportsArtifacts ?? false,
    supportsReasoning:
      supportsReasoning ?? metadata?.supportsReasoning ?? false,
    requiresThinkingPrompt:
      requiresThinkingPrompt ?? metadata?.requiresThinkingPrompt ?? false,
  };
}

export function getResponseStyle(
  response_mode = "normal",
  supportsReasoning = false,
  requiresThinkingPrompt = false,
  supportsToolCalls = false,
  supportsArtifacts = false,
  isAgent = false,
  memoriesEnabled = false,
  userTraits?: string,
  userPreferences?: string,
  isCoding = false,
  instructionVariant: "full" | "compact" = "full",
): {
  traits: string;
  preferences: string;
  problemBreakdownInstructions: string;
  answerFormatInstructions: string;
} {
  const DEFAULT_TRAITS =
    userTraits ||
    "direct, intellectually curious, balanced in verbosity (concise for simple questions, thorough for complex ones), systematic in reasoning for complex problems";

  const FULL_DEFAULT_PREFERENCES = `- Answer directly without unnecessary affirmations or filler phrases
  - Use step-by-step reasoning when solving math, logic, or complex problems
  - Match response length to question complexity - concise for simple questions, thorough for complex ones
  - Offer to elaborate rather than providing exhaustive detail upfront
  - For obscure topics, acknowledge potential hallucination risk
  - When citing specific sources, note that citations should be verified
  - Ask at most one thoughtful follow-up question when appropriate
  - You should use Markdown to format your response.
  - Write your response in the same language as the task posed by the user.`;

  const COMPACT_DEFAULT_PREFERENCES = `- Provide clear, direct answers without filler.
  - Ask for missing details only when they are essential to proceed.
  - Match explanation depth to the task's complexity.
  - Use Markdown sparingly; only when it improves readability.
  - Reply in the same language the user used.`;

  const DEFAULT_PREFERENCES =
    userPreferences ||
    (instructionVariant === "compact"
      ? COMPACT_DEFAULT_PREFERENCES
      : FULL_DEFAULT_PREFERENCES);

  if (instructionVariant === "compact") {
    const compactProblemBreakdownInstructions = (() => {
      switch (response_mode) {
        case "concise":
          return "Capture only the key checks or steps before you answer.";
        case "formal":
          return "Outline the essential steps with precise terminology.";
        case "explanatory":
          return "Highlight the main stages you'll cover before the final answer.";
        default:
          return "Sketch the steps that matter so your answer stays focused.";
      }
    })();

    const compactAnswerFormatInstructions = (() => {
      const deliverable = isCoding ? "code" : "answer";
      switch (response_mode) {
        case "concise":
          return `Provide the ${deliverable} with only the context the user needs to act.`;
        case "formal":
          return `Present the ${deliverable} with clear structure and precise language.`;
        case "explanatory":
          return `Deliver the ${deliverable} and briefly walk through the reasoning or workflow.`;
        default:
          return `Share the ${deliverable} and call out the key insight or next step for the user.`;
      }
    })();

    if (isAgent) {
      let agentPreferences = DEFAULT_PREFERENCES;
      const agentGuidelines: string[] = [];

      if (supportsToolCalls) {
        agentGuidelines.push(
          "Coordinate tool use thoughtfully and summarise results before continuing.",
        );
      }

      if (supportsArtifacts) {
        agentGuidelines.push(
          "Place sizeable or reusable deliverables in artifacts and reference them succinctly.",
        );
      }

      agentGuidelines.push(
        "Flag uncertainty or blocking gaps early so the user can redirect you.",
      );

      if (agentGuidelines.length > 0) {
        agentPreferences += `\n- Also keep in mind:\n${agentGuidelines
          .map((line) => `  - ${line}`)
          .join("\n")}`;
      }

      if (memoriesEnabled) {
        agentPreferences += `\n- Offer to store important facts or preferences when it will help future work.`;
      } else {
        agentPreferences += `\n- If asked to remember something, explain that memories are currently disabled for this user.`;
      }

      return {
        traits: DEFAULT_TRAITS,
        preferences: agentPreferences,
        problemBreakdownInstructions: compactProblemBreakdownInstructions,
        answerFormatInstructions: compactAnswerFormatInstructions,
      };
    }

    const additionalGuidelines: string[] = [];

    if (!supportsReasoning || requiresThinkingPrompt) {
      additionalGuidelines.push(
        "Use <think> to sketch your approach before sharing the final answer.",
      );
      if (isCoding) {
        additionalGuidelines.push(
          "Note the main components or edge cases in your plan before coding.",
        );
      }
    }

    if (supportsToolCalls) {
      additionalGuidelines.push(
        "Use tools only when they add value and summarise their output briefly.",
      );
    }

    if (supportsArtifacts) {
      additionalGuidelines.push(
        "Create an artifact for long or reusable deliverables and describe it in chat.",
      );
    }

    additionalGuidelines.push(
      "Flag uncertainty or missing information instead of guessing.",
    );
    additionalGuidelines.push(
      "Scale your explanation to the complexity of the request.",
    );

    let preferences = DEFAULT_PREFERENCES;

    if (additionalGuidelines.length > 0) {
      preferences += `\n- Also follow:\n${additionalGuidelines
        .map((line) => `  - ${line}`)
        .join("\n")}`;
    }

    if (isCoding) {
      preferences += `\n- Format code with fenced blocks and point out assumptions or edge cases.`;
    } else {
      preferences += `\n- Keep responses in plain text unless a short code sample improves clarity.`;
    }

    if (memoriesEnabled) {
      preferences += `\n- Offer to store important details when it benefits the user later.`;
    } else {
      preferences += `\n- If the user asks you to remember something, explain that memories are disabled.`;
    }

    return {
      traits: DEFAULT_TRAITS,
      preferences,
      problemBreakdownInstructions: compactProblemBreakdownInstructions,
      answerFormatInstructions: compactAnswerFormatInstructions,
    };
  }

  if (isAgent) {
    return {
      traits: DEFAULT_TRAITS,
      preferences: DEFAULT_PREFERENCES,
      problemBreakdownInstructions:
        "Provide a balanced problem breakdown that covers the important aspects without being overly verbose.",
      answerFormatInstructions: `Balance ${isCoding ? "code" : "answer"} with explanation, providing enough context to understand the solution without overwhelming detail.`,
    };
  }

  let PREFERENCES_WITH_INSTRUCTIONS = `${DEFAULT_PREFERENCES}
  - Please also follow these instructions:\n`;

  let step = 1;
  PREFERENCES_WITH_INSTRUCTIONS += `${step++}. Read and understand questions carefully.\n`;
  PREFERENCES_WITH_INSTRUCTIONS += `${step++}. If the question is unclear or lacks necessary information, ask for clarification.\n`;

  if (!supportsReasoning || requiresThinkingPrompt) {
    PREFERENCES_WITH_INSTRUCTIONS += `${step}. Analyze the question and context thoroughly before answering and identify key information from the user's question, return this analysis using the following template:
    <think>
      Your thoughts or/and draft, like working through an exercise on scratch paper.
    </think>\n`;
    if (isCoding) {
      for (let sub = 1; sub <= 6; sub++) {
        switch (sub) {
          case 1: {
            PREFERENCES_WITH_INSTRUCTIONS += `${step}.1: Break down the problem into smaller components.\n`;
            break;
          }
          case 2: {
            PREFERENCES_WITH_INSTRUCTIONS += `${step}.2: List any assumptions you're making about the problem.\n`;
            break;
          }
          case 3: {
            PREFERENCES_WITH_INSTRUCTIONS += `${step}.3: Plan your approach to solving the problem or generating the code.\n`;
            break;
          }
          case 4: {
            PREFERENCES_WITH_INSTRUCTIONS += `${step}.4: Write pseudocode for your solution.\n`;
            break;
          }
          case 5: {
            PREFERENCES_WITH_INSTRUCTIONS += `${step}.5: Consider potential edge cases or limitations of your solution.\n`;
            break;
          }
          case 6: {
            PREFERENCES_WITH_INSTRUCTIONS += `${step}.6: If generating code, write it out and then analyze it for correctness, efficiency, and adherence to best practices.\n`;
            break;
          }
        }
      }
    }

    if (supportsToolCalls) {
      const subBase = isCoding ? `${step}.7` : `${step}.1`;
      PREFERENCES_WITH_INSTRUCTIONS += `${subBase} Determine whether the query can be resolved directly or if a tool is required. Use the description of the tool to help you decide.\n`;
      PREFERENCES_WITH_INSTRUCTIONS += `${subBase}.1 If a tool is required, use it to answer the question.\n`;
      PREFERENCES_WITH_INSTRUCTIONS += `${subBase}.2 If the task can be effectively answered without a tool, prioritize a manual response.\n`;
    }

    if (supportsArtifacts) {
      let artifactSub;
      if (isCoding && supportsToolCalls) {
        artifactSub = `${step}.8`;
      } else if (isCoding) {
        artifactSub = `${step}.7`;
      } else {
        artifactSub = `${step}.2`;
      }
      PREFERENCES_WITH_INSTRUCTIONS += `${artifactSub} Determine if the response would benefit from using an artifact based on the included criteria.\n`;
    }

    let finalSub;
    if (isCoding && supportsToolCalls && supportsArtifacts) {
      finalSub = `${step}.9`;
    } else if (isCoding && (supportsToolCalls || supportsArtifacts)) {
      finalSub = `${step}.${supportsToolCalls && supportsArtifacts ? 9 : 8}`;
    } else if (isCoding) {
      finalSub = `${step}.7`;
    } else {
      finalSub = `${step}.${supportsToolCalls && supportsArtifacts ? 3 : supportsToolCalls || supportsArtifacts ? 2 : 1}`;
    }
    PREFERENCES_WITH_INSTRUCTIONS += `${finalSub} It's OK for this section to be quite long.\n`;
    step++;
  }

  PREFERENCES_WITH_INSTRUCTIONS += `${step++}. If you're unsure or don't have the information to answer, say "I don't know" or offer to find more information.\n`;

  if (isCoding) {
    PREFERENCES_WITH_INSTRUCTIONS += `${step}. When coding, always use markdown to format your code.\n`;
    for (let sub = 1; sub <= 5; sub++) {
      switch (sub) {
        case 1:
          PREFERENCES_WITH_INSTRUCTIONS += `${step}.1. Ensure the code adheres to best practices and conventions for the specified programming language.\n`;
          break;
        case 2:
          PREFERENCES_WITH_INSTRUCTIONS += `${step}.2. Write clean, efficient, and well-documented code.\n`;
          break;
        case 3:
          PREFERENCES_WITH_INSTRUCTIONS += `${step}.3. Include comments to explain complex logic or non-obvious implementations.\n`;
          break;
        case 4:
          PREFERENCES_WITH_INSTRUCTIONS += `${step}.4. If the task requires multiple functions or classes, structure the code logically and use appropriate naming conventions.\n`;
          break;
        case 5:
          PREFERENCES_WITH_INSTRUCTIONS += `${step}.5. For substantial code solutions, consider using an artifact tag instead.\n`;
          break;
      }
    }
    step++;
  } else {
    PREFERENCES_WITH_INSTRUCTIONS += `${step++}. Always respond in plain text, not computer code.\n`;
  }

  if (supportsArtifacts) {
    PREFERENCES_WITH_INSTRUCTIONS += getArtifactInstructions(
      supportsArtifacts,
      false,
      step,
      "full",
    );
    step += 1;
  }

  PREFERENCES_WITH_INSTRUCTIONS += `${step++}. For complex questions requiring systematic thinking, show your reasoning step by step before providing your final answer.\n`;
  PREFERENCES_WITH_INSTRUCTIONS += `${step++}. For simple questions, provide direct and concise answers without unnecessary explanation.\n`;
  PREFERENCES_WITH_INSTRUCTIONS += `${step++}. When discussing obscure topics or citing specific sources, acknowledge limitations in knowledge when appropriate.\n`;
  PREFERENCES_WITH_INSTRUCTIONS += `${step++}. Engage thoughtfully with user's ideas and show intellectual curiosity in the discussion.`;

  if (memoriesEnabled) {
    PREFERENCES_WITH_INSTRUCTIONS += `\n${step++}. You have the ability to store long-term conversational memories when the user asks you to remember important facts or events, and will recall them when relevant.`;
  } else {
    PREFERENCES_WITH_INSTRUCTIONS += `\n${step++}. The memories feature has been disabled for this user. If the user asks you to remember something, politely ask them to go to Settings > Customisation > Memories to enable it.`;
  }

  switch (response_mode) {
    case "concise":
      return {
        traits: DEFAULT_TRAITS,
        preferences: PREFERENCES_WITH_INSTRUCTIONS,
        problemBreakdownInstructions:
          "Keep your problem breakdown brief, focusing only on the most critical aspects of the problem.",
        answerFormatInstructions: `Provide your ${isCoding ? "code" : "answer"} with minimal explanation, focusing on the answer itself.`,
      };
    case "explanatory":
      return {
        traits: DEFAULT_TRAITS,
        preferences: PREFERENCES_WITH_INSTRUCTIONS,
        problemBreakdownInstructions:
          "Provide a thorough problem breakdown with detailed explanations of your thought process and approach.",
        answerFormatInstructions: `Explain your ${isCoding ? "code" : "answer"} in detail, including the reasoning behind your implementation choices and how each part works.`,
      };
    case "formal":
      return {
        traits: DEFAULT_TRAITS,
        preferences: PREFERENCES_WITH_INSTRUCTIONS,
        problemBreakdownInstructions:
          "Structure your problem breakdown formally, using proper technical terminology and a methodical approach.",
        answerFormatInstructions: `Present your ${isCoding ? "code" : "answer"} in a formal, structured manner with appropriate technical terminology and documentation.`,
      };
    default:
      return {
        traits: DEFAULT_TRAITS,
        preferences: PREFERENCES_WITH_INSTRUCTIONS,
        problemBreakdownInstructions:
          "Provide a balanced problem breakdown that covers the important aspects without being overly verbose.",
        answerFormatInstructions: `Balance your ${isCoding ? "code" : "answer"} with explanation, providing enough context to understand the solution without overwhelming detail.`,
      };
  }
}

/**
 * Returns an example artifact based on context
 * @param supportsArtifacts Whether artifacts are supported in the current environment
 * @param forCode Whether example should be for code specifically
 * @returns Example string or empty string if artifacts not supported
 */
export function getArtifactExample(
  supportsArtifacts = false,
  forCode = false,
  variant: "full" | "compact" = "full",
): string {
  if (!supportsArtifacts) {
    return "";
  }

  const guidance = [
    "Use artifacts for deliverables the user may reuse or download later.",
    "Reference each artifact in your main response so the user understands what it contains.",
    "Reuse an existing artifact identifier when updating earlier work; choose a new one for fresh deliverables.",
  ];

  if (variant === "compact") {
    const compactExample = forCode
      ? `<artifact identifier="solution-snippet" type="application/code" language="{{programming_language}}">
// Final implementation
</artifact>`
      : `<artifact identifier="deliverable" type="text/markdown">
Provide the full deliverable here.
</artifact>`;

    return `<artifact_hint>
${guidance.map((line) => `  - ${line}`).join("\n")}
  ${compactExample}
  <reminder>Summarise the artifact contents in your prose.</reminder>
</artifact_hint>`;
  }

  const sampleArtifact = forCode
    ? `<artifact identifier="solution-snippet" type="application/code" language="{{programming_language}}">
// Main implementation
function example() {
  // ...
}
</artifact>`
    : `<artifact identifier="deliverable" type="text/markdown">
# Outline
- Key point 1
- Key point 2
</artifact>`;

  return `<artifact_example>
  <when_to_use>Create an artifact when the deliverable is longer than a few paragraphs, benefits from syntax highlighting, or should be downloaded intact.</when_to_use>
  <creation_steps>
    <step>Pick a clear identifier (kebab-case) and reuse it when iterating on the same work.</step>
    <step>Add a short title and the correct MIME type so the client can render it.</step>
    <step>Mention the artifact in your response with a plain-language summary.</step>
  </creation_steps>
  ${sampleArtifact}
  <follow_up>Offer to adjust or extend the artifact if the user needs changes.</follow_up>
</artifact_example>`;
}

function getArtifactTypeInstructions(forCode = false): string {
  if (forCode) {
    return `- Code: "application/vnd.code"
          - Use for code snippets or scripts in any programming language.
          - Include the language name as the value of the \`language\` attribute (e.g., \`language="python"\`).
          - Do not use triple backticks when putting code in an artifact.
        - Documents: "text/markdown"
            - Use for plain text, Markdown, or other formatted text documents.
        - HTML: "text/html"
          - The user interface can render single file HTML pages placed within the artifact tags. HTML, JS, and CSS should be in a single file when using the \`text/html\` type.
          - Images from the web are not allowed, but you can use placeholder images by specifying the width and height like so \`<img src="/api/placeholder/400/320" alt="placeholder" />\`
          - The only place external scripts can be imported from is https://cdnjs.cloudflare.com
          - It is inappropriate to use "text/html" when sharing snippets, code samples & example HTML or CSS code, as it would be rendered as a webpage and the source code would be obscured. The assistant should instead use "application/vnd.code" defined above.
          - If the assistant is unable to follow the above requirements for any reason, use "application/vnd.code" type for the artifact instead, which will not attempt to render the webpage.
        - SVG: "image/svg+xml"
          - The user interface will render the Scalable Vector Graphics (SVG) image within the artifact tags.
          - The assistant should specify the viewbox of the SVG rather than defining a width/height
        - Mermaid Diagrams: "text/vnd.mermaid"
          - The user interface will render Mermaid diagrams placed within the artifact tags.
          - Do not put Mermaid code in a code block when using artifacts.
        - React Components: "application/vnd.react"
          - Use this for displaying either: React elements, e.g. \`<strong>Hello World!</strong>\`, React pure functional components, e.g. \`() => <strong>Hello World!</strong>\`, React functional components with Hooks, or React component classes
          - When creating a React component, ensure it has no required props (or provide default values for all props) and use a default export.
          - Use Tailwind classes for styling. DO NOT USE ARBITRARY VALUES (e.g. \`h-[600px]\`).
          - Base React is available to be imported. To use hooks, first import it at the top of the artifact, e.g. \`import { useState } from "react"\`
          - The lucide-react@0.263.1 library is available to be imported. e.g. \`import { Camera } from "lucide-react"\` & \`<Camera color="red" size={48} />\`
          - The recharts charting library is available to be imported, e.g. \`import { LineChart, XAxis, ... } from "recharts"\` & \`<LineChart ...><XAxis dataKey="name"> ...\`
          - The assistant can use prebuilt components from the \`shadcn/ui\` library after it is imported: \`import { Alert, AlertDescription, AlertTitle, AlertDialog, AlertDialogAction } from '@/components/ui/alert';import { type } from "os"\`. If using components from the shadcn/ui library, the assistant mentions this to the user and offers to help them install the components if necessary.
          - NO OTHER LIBRARIES (e.g. zod, hookform) ARE INSTALLED OR ABLE TO BE IMPORTED.
          - Images from the web are not allowed, but you can use placeholder images by specifying the width and height like so \`<img src="/api/placeholder/400/320" alt="placeholder" />\`
          - If you are unable to follow the above requirements for any reason, use "application/vnd.code" type for the artifact instead, which will not attempt to render the component.`;
  }

  return `- "text/markdown" for documentation
      - "text/html" for web content
      - "image/svg+xml" for diagrams
      - "application/mermaid" for flowcharts`;
}

/**
 * Returns artifact usage instructions based on context
 * @param supportsArtifacts Whether artifacts are supported in the current environment
 * @param forCode Whether instructions should focus on code artifacts specifically
 * @param startIndex The starting index for numbered instructions
 * @returns Instructions string or empty string if artifacts not supported
 */
export function getArtifactInstructions(
  supportsArtifacts = false,
  forCode = false,
  startIndex = 1,
  variant: "full" | "compact" = "full",
): string {
  if (!supportsArtifacts) return "";

  if (variant === "compact") {
    return `${startIndex}. When using artifacts, keep them lightweight:
   - Reserve artifacts for deliverables the user may reuse or download.
   - Summarise each artifact in your response so the user knows what's inside.
   - Reuse identifiers when updating earlier work to keep context linked.`;
  }

  const baseInstructions = `${startIndex}. When creating artifacts:
   a. Use artifacts for substantial, self-contained content (>15 lines) 
      that users might modify or reuse
   b. You can also use artifacts for content intended for eventual use
      outside the conversation such as reports, emails, etc
   c. Don't use artifacts for simple snippets, explanations, or 
      context-dependent content
   d. Don't use artifacts for content that appears to be a one-off question
   e. Include these attributes:
      - identifier: A descriptive kebab-case id (e.g., "sorting-algorithm")
        when updating an artifact, reuse the prior identifier.
      - title: Brief description of the content
      - type: Appropriate content type that the type of content the artifact
        represents, assign one of the following:
        ${getArtifactTypeInstructions(forCode)}
   f. Only use of artifact per message unless specifically requested.
   g. If a user asks the assistant to "draw an SVG" or "make a website", the
      assistant should create the code for that and place it within an artifact.`;

  return baseInstructions;
}

/**
 * Return an empty prompt string
 */
export function emptyPrompt(): string {
  return "";
}
