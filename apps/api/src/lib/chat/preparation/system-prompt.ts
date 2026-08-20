import type { Goal, SkillAvailability } from "@ngriffin_uk/polychat-schemas";

import { buildMemoryPromptContext, type resolveMemoryPolicy } from "~/lib/chat/policy/memory";
import { getSystemPrompt } from "~/lib/prompts";
import { buildGoalContractSection } from "~/lib/prompts/sections/goal";
import type { RepositoryManager } from "~/repositories";
import type { ProjectChatContext } from "~/services/workspaces/chatContext";
import type { CoreChatOptions, MemoryScope, Message } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/preparation/system-prompt" });

export interface BuildSystemPromptParams {
  options: CoreChatOptions;
  repositories: RepositoryManager;
  sanitisedMessages: Message[];
  finalMessage: string;
  primaryModel: string;
  userSettings: any;
  memoryPolicy: ReturnType<typeof resolveMemoryPolicy>;
  projectContext: ProjectChatContext | null;
  memoryScope?: MemoryScope;
  skills?: readonly SkillAvailability[];
  activeGoal?: Goal | null;
}

function appendSection(prompt: string, section: string): string {
  return prompt ? `${prompt}\n\n${section}` : section;
}

export function appendProjectInstructions(
  systemPrompt: string,
  projectContext: ProjectChatContext | null,
  activeGoal?: Goal | null,
): string {
  let prompt = systemPrompt;

  if (projectContext?.instructions) {
    prompt = appendSection(prompt, `Project instructions:\n${projectContext.instructions}`);
  }

  if (activeGoal && activeGoal.status === "active") {
    prompt = appendSection(prompt, buildGoalContractSection(activeGoal));
  }

  return prompt;
}

async function appendMemoryContext(
  systemPrompt: string,
  {
    repositories,
    finalMessage,
    user,
    memoriesEnabled,
    memoryScope,
  }: {
    repositories: RepositoryManager;
    finalMessage: string;
    user: any;
    memoriesEnabled: boolean;
    memoryScope: MemoryScope;
  },
): Promise<string> {
  if (!memoriesEnabled || !finalMessage || !user?.id || memoryScope.type !== "personal") {
    return systemPrompt;
  }

  try {
    const synthesis = await repositories.memorySyntheses.getActiveSynthesis(user.id, "global");
    const memoryContext = buildMemoryPromptContext({
      synthesisText: synthesis?.synthesis_text,
    });

    return memoryContext ? `${systemPrompt}\n${memoryContext}` : systemPrompt;
  } catch (error) {
    logger.warn("Failed to read the memory synthesis", { error, userId: user?.id });

    return systemPrompt;
  }
}

export async function buildSystemPrompt({
  options,
  repositories,
  sanitisedMessages,
  finalMessage,
  primaryModel,
  userSettings,
  memoryPolicy,
  projectContext,
  memoryScope = { type: "personal" },
  skills,
  activeGoal,
}: BuildSystemPromptParams): Promise<string> {
  const {
    system_prompt,
    mode = "normal",
    verbosity,
    reasoning_effort,
    max_tokens,
    location,
    completion_id,
  } = options;
  const user = options.context?.user;

  if (mode === "no_system") {
    return appendProjectInstructions("", projectContext, activeGoal);
  }

  const memoryContext = {
    repositories,
    finalMessage,
    user,
    memoriesEnabled: memoryPolicy.enabled,
    memoryScope,
  };

  const withMemory = async (prompt: string) =>
    appendProjectInstructions(
      await appendMemoryContext(prompt, memoryContext),
      projectContext,
      activeGoal,
    );

  if (system_prompt) {
    return withMemory(system_prompt);
  }

  const systemPromptFromMessages = sanitisedMessages.find((message) => message.role === "system");

  if (typeof systemPromptFromMessages?.content === "string" && systemPromptFromMessages.content) {
    return withMemory(systemPromptFromMessages.content);
  }

  const generatedPrompt = await getSystemPrompt({
    request: {
      completion_id,
      input: finalMessage,
      model: primaryModel,
      provider: options.provider,
      date: new Date().toISOString().split("T")[0],
      location,
      mode,
      verbosity,
      reasoning_effort,
      max_tokens,
      options: options.options,
    },
    model: primaryModel,
    user: user || undefined,
    userSettings,
    skills,
    memory: memoryPolicy,
    persona: options.persona,
  });

  return withMemory(generatedPrompt);
}
