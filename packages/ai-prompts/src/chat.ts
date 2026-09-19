import { escapeHtml } from "@ngriffin_uk/polychat-utility-core";

import { PromptBuilder } from "./builder.js";
import { getPromptText, renderPrompt, tryGetPrompt } from "./prompts.js";

const AGENT_MODES = new Set(["agent", "plan", "build", "explore"]);
const JOURNAL_TAIL_LENGTH = 5;

export interface AssistantModelMetadata {
  modelId: string;
  provider?: string;
  displayName?: string;
  inputModalities?: readonly string[];
  outputModalities?: readonly string[];
  contextWindow?: number;
  effectiveMaxOutputTokens?: number;
  knowledgeCutoff?: string;
  releaseDate?: string;
  lastUpdated?: string;
  supportedCapabilities?: readonly string[];
  supportsToolCalls?: boolean;
}

export interface AssistantMetadataOptions {
  assistantName: string;
  assistantDescription: string;
  model: AssistantModelMetadata;
}

export interface PromptCapabilities {
  supportsToolCalls: boolean;
  simulatedThinking: boolean;
}

export interface ResolvePromptCapabilityArgs {
  supportsToolCalls?: boolean;
  simulatedThinking?: boolean;
  model?: AssistantModelMetadata;
}

export interface ResponseStyle {
  traits: string;
  preferences: string;
}

export interface ResponseStyleOptions {
  verbosity?: string;
  userTraits?: string | null;
  userPreferences?: string | null;
  isCoding?: boolean;
  isTeammate?: boolean;
  simulatedThinking?: boolean;
}

export interface AssistantPersonaInput {
  name?: string | null;
  instructions?: string | null;
  examples?: readonly { input: string; output: string }[];
}

export interface ChannelContextInput {
  id: string;
  label: string;
  from?: string | null;
  to?: string | null;
}

export interface SkillDisclosure {
  id: string;
  description: string;
}

export interface PromptMemoryPolicy {
  enabled: boolean;
  canRetrieve: boolean;
  canStore: boolean;
}

export interface UserContextInput {
  date: string;
  userNickname?: string | null;
  userJobRole?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  language?: string | null;
}

export interface GoalProgressEntryInput {
  surface: string;
  summary: string;
  steer?: string | null;
  evidence: readonly string[];
  next?: string | null;
}

export interface GoalInput {
  objective: string;
  stall_streak: number;
  iteration_count: number;
  progress: readonly GoalProgressEntryInput[];
}

export interface BehaviourSectionOptions {
  assistantName: string;
  isTeammate: boolean;
  supportsToolCalls?: boolean;
  simulatedThinking?: boolean;
  preferredLanguage?: string | null;
}

export function isAgentMode(mode?: string | null): boolean {
  return AGENT_MODES.has(mode ?? "standard");
}

export function resolvePromptCapabilities({
  supportsToolCalls,
  simulatedThinking,
  model,
}: ResolvePromptCapabilityArgs): PromptCapabilities {
  return {
    supportsToolCalls: supportsToolCalls ?? model?.supportsToolCalls ?? false,
    simulatedThinking: simulatedThinking ?? false,
  };
}

function asList(values?: readonly string[]): string {
  return values && values.length > 0 ? values.join(", ") : "unspecified";
}

export function buildAssistantMetadataSection({
  assistantName,
  assistantDescription,
  model,
}: AssistantMetadataOptions): string {
  const supportedCapabilities =
    model.supportedCapabilities && model.supportedCapabilities.length > 0
      ? model.supportedCapabilities.join(", ")
      : "none";

  const identity = renderPrompt("chat/identity", { assistantName, assistantDescription });
  const modelCard = renderPrompt("chat/model-card", {
    modelId: model.modelId,
    provider: model.provider,
    displayName: model.displayName,
    inputModalities: asList(model.inputModalities),
    outputModalities: asList(model.outputModalities),
    contextWindow: model.contextWindow,
    effectiveMaxOutputTokens: model.effectiveMaxOutputTokens,
    knowledgeCutoff: model.knowledgeCutoff,
    releaseDate: model.releaseDate,
    lastUpdated: model.lastUpdated,
    supportedCapabilities,
  });

  return `${identity}\n\n${modelCard}\n\n`;
}

export function buildInstructionPrecedence(isCoding: boolean): string {
  return getPromptText(
    isCoding ? "chat/instruction-precedence/coding" : "chat/instruction-precedence/standard",
  );
}

export function buildBehaviourSection({
  assistantName,
  isTeammate,
  supportsToolCalls,
  simulatedThinking,
  preferredLanguage,
}: BehaviourSectionOptions): string {
  const builder = new PromptBuilder("<behaviour>").addLine();
  const addRule = (text: string) => builder.addLine(`<rule>${text}</rule>`);

  addRule(getPromptText("chat/behaviour/rules/intent"));
  addRule(getPromptText("chat/behaviour/rules/reasoning"));
  addRule(getPromptText("chat/behaviour/rules/grounding"));
  addRule(renderPrompt("chat/behaviour/rules/tone", { assistantName }));
  addRule(getPromptText("chat/behaviour/rules/next-steps"));

  if (supportsToolCalls || isTeammate) {
    addRule(getPromptText("chat/behaviour/rules/tools"));
    addRule(getPromptText("chat/behaviour/rules/tool-failure"));
  }

  if (simulatedThinking) {
    addRule(getPromptText("chat/behaviour/rules/simulated-thinking"));
  }

  addRule(getPromptText("chat/behaviour/rules/date"));

  const sanitizedLanguage = preferredLanguage?.trim();

  if (sanitizedLanguage) {
    addRule(
      renderPrompt("chat/behaviour/rules/preferred-language", {
        preferredLanguage: sanitizedLanguage,
      }),
    );
  } else {
    addRule(getPromptText("chat/behaviour/rules/language"));
  }

  return builder.addLine("</behaviour>").addLine().build();
}

export function buildPersonaSection(persona?: AssistantPersonaInput | null): string {
  if (!persona?.instructions && !persona?.examples?.length) {
    return "";
  }

  const builder = new PromptBuilder("<persona>").addLine();

  if (persona.name) {
    builder.addLine(renderPrompt("chat/persona/name", { personaName: persona.name }));
  }

  if (persona.instructions) {
    builder.addLine(
      renderPrompt("chat/persona/instructions", {
        personaInstructions: persona.instructions.trim(),
      }),
    );
  }

  const examples = persona.examples ?? [];

  if (examples.length > 0) {
    builder.addLine("<examples>");

    for (const example of examples) {
      builder.addLine(
        renderPrompt("chat/persona/example", {
          exampleInput: example.input,
          exampleOutput: example.output,
        }),
      );
    }

    builder.addLine("</examples>");
  }

  return builder.addLine("</persona>").addLine().build();
}

export function buildResponseStyleSection({ traits, preferences }: ResponseStyle): string {
  return `${renderPrompt("chat/response-style", {
    traits: escapeHtml(traits),
    preferences: escapeHtml(preferences),
  })}\n\n`;
}

export function getResponseStyle({
  verbosity,
  userTraits,
  userPreferences,
  isCoding = false,
  isTeammate = false,
  simulatedThinking = false,
}: ResponseStyleOptions): ResponseStyle {
  if (verbosity === "caveman") {
    const cavemanPreferences = getPromptText("chat/response-style/caveman-preferences");

    return {
      traits: getPromptText("chat/response-style/caveman-traits"),
      preferences: userPreferences
        ? `${cavemanPreferences}\n${renderPrompt("chat/response-style/caveman-user-preferences", { userPreferences })}`
        : cavemanPreferences,
    };
  }

  const normalizedVerbosity = verbosity === "low" || verbosity === "high" ? verbosity : "medium";
  const traits = userTraits || getPromptText("chat/response-style/default-traits");
  const preferences = [
    getPromptText("chat/response-style/preference/direct"),
    getPromptText("chat/response-style/preference/length"),
    getPromptText("chat/response-style/preference/elaborate"),
  ];

  if (simulatedThinking) {
    preferences.push(getPromptText("chat/response-style/preference/simulated-thinking"));

    if (isCoding) {
      preferences.push(getPromptText("chat/response-style/preference/simulated-thinking-coding"));
    }
  }

  if (userPreferences) {
    preferences.push(renderPrompt("chat/response-style/preference/user", { userPreferences }));
  }

  preferences.push(
    getPromptText(`chat/response-style/preference/verbosity-${normalizedVerbosity}`),
  );

  if (isTeammate) {
    preferences.push(getPromptText("chat/response-style/preference/teammate-outcomes"));
  }

  return {
    traits,
    preferences: preferences.map((preference) => `- ${preference}`).join("\n"),
  };
}

export function buildFormattingSection({ isCoding = false }: { isCoding?: boolean } = {}): string {
  return `${renderPrompt(isCoding ? "chat/formatting/coding" : "chat/formatting/standard")}\n\n`;
}

export function buildCodingConductSection(): string {
  return `${getPromptText("chat/coding-conduct")}\n\n`;
}

export function buildSafetyStandardsSection(): string {
  return `${getPromptText("chat/safety")}\n\n`;
}

export function buildAgentGuidelinesSection(): string {
  return `${getPromptText("chat/agent-guidelines")}\n\n`;
}

export function buildChannelSection(channel?: ChannelContextInput | null): string {
  if (!channel) {
    return "";
  }

  const constraints = tryGetChannelConstraints(channel.id);
  const lines = [
    "<channel_context>",
    `<channel>${escapeHtml(channel.label)}</channel>`,
    `<sender>${channel.from ? escapeHtml(channel.from) : "unavailable"}</sender>`,
    `<recipient>${channel.to ? escapeHtml(channel.to) : "unavailable"}</recipient>`,
    "<constraints>",
    ...(constraints ? constraints.split("\n") : []),
    "</constraints>",
    "</channel_context>",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function tryGetChannelConstraints(id: string): string | undefined {
  return tryGetPrompt(`chat/channel/${id}`)?.text;
}

export function buildSkillsSection(
  skills: readonly SkillDisclosure[] | undefined,
  options: { skillLoadTool?: string } = {},
): string {
  const disclosed = skills ?? [];

  if (disclosed.length === 0) {
    return "";
  }

  const builder = new PromptBuilder("<available_skills>").addLine(
    renderPrompt("chat/skills/intro", { skillLoadTool: options.skillLoadTool ?? "load_skill" }),
  );

  for (const skill of disclosed) {
    builder.addLine(
      renderPrompt("chat/skills/skill", {
        skillId: escapeHtml(skill.id),
        skillDescription: escapeHtml(skill.description),
      }),
    );
  }

  return builder.addLine("</available_skills>").addLine().build();
}

export function buildUserContextSection({
  date,
  userNickname,
  userJobRole,
  latitude,
  longitude,
  language,
}: UserContextInput): string {
  const builder = new PromptBuilder("<user_context>")
    .addLine()
    .addIf(
      !!userNickname,
      renderPrompt("chat/user-context/nickname", { userNickname: escapeHtml(userNickname ?? "") }),
    )
    .addIf(
      !!userJobRole,
      renderPrompt("chat/user-context/job-role", { userJobRole: escapeHtml(userJobRole ?? "") }),
    )
    .addIf(!!date, renderPrompt("chat/user-context/date", { date: escapeHtml(date) }));

  if (
    latitude !== undefined &&
    latitude !== null &&
    longitude !== undefined &&
    longitude !== null
  ) {
    builder.addLine(renderPrompt("chat/user-context/location", { latitude, longitude }));
  }

  builder.addIf(
    !!language,
    renderPrompt("chat/user-context/language", { preferredLanguage: escapeHtml(language ?? "") }),
  );

  return builder.addLine("</user_context>").addLine().build();
}

function buildMemoryPolicy(memory: PromptMemoryPolicy): string {
  const instructionVariant = memory.canStore
    ? "store"
    : memory.canRetrieve
      ? "retrieve"
      : "disabled";

  return renderPrompt("chat/session-config/memory-policy", {
    memoryStatus: memory.enabled ? "enabled" : "disabled",
    memoryRetrieval: memory.canRetrieve ? "enabled" : "disabled",
    memoryStorage: memory.canStore ? "enabled" : "disabled",
    memoryInstruction: getPromptText(
      `chat/session-config/memory-instruction/${instructionVariant}`,
    ),
  });
}

export function buildSessionConfigSection({
  mode = "standard",
  platform,
  verbosity = "medium",
  preferredLanguage,
  memory,
}: {
  mode?: string;
  platform?: string | null;
  verbosity?: string;
  preferredLanguage?: string | null;
  memory: PromptMemoryPolicy;
}): string {
  return new PromptBuilder("<session_config>")
    .addLine()
    .addLine(`<mode>${mode}</mode>`)
    .addIf(!!platform, renderPrompt("chat/session-config/platform", { platform: platform ?? "" }))
    .add(renderPrompt("chat/session-config/verbosity", { verbosity }))
    .addIf(
      !!preferredLanguage,
      renderPrompt("chat/session-config/language", {
        preferredLanguage: escapeHtml(preferredLanguage ?? ""),
      }),
    )
    .add(buildMemoryPolicy(memory))
    .addLine()
    .addLine("</session_config>")
    .addLine()
    .build();
}

export function buildMemorySummaryContext({
  synthesisText,
  memorySearchTool,
}: {
  synthesisText: string;
  memorySearchTool: string;
}): string {
  return `\n\n${renderPrompt("chat/session-config/memory-summary", {
    memorySearchTool,
    memorySynthesis: synthesisText,
  })}`;
}

function formatJournalEntry(entry: GoalProgressEntryInput): string {
  const lines = [
    renderPrompt("chat/goal/journal/base", { surface: entry.surface, summary: entry.summary }),
  ];

  if (entry.steer) {
    lines.push(renderPrompt("chat/goal/journal/steer", { steer: entry.steer }));
  }

  if (entry.evidence.length > 0) {
    lines.push(renderPrompt("chat/goal/journal/evidence", { evidence: entry.evidence.join(", ") }));
  }

  if (entry.next) {
    lines.push(renderPrompt("chat/goal/journal/next", { next: entry.next }));
  }

  return lines.join("\n");
}

export function buildGoalContractSection(goal: GoalInput): string {
  const journal = goal.progress.slice(-JOURNAL_TAIL_LENGTH);
  const lines = [
    "<active_goal>",
    renderPrompt("chat/goal/objective", { objective: goal.objective }),
    getPromptText("chat/goal/completion-rule"),
    getPromptText("chat/goal/blocked-rule"),
  ];

  if (goal.stall_streak > 0) {
    lines.push(getPromptText("chat/goal/stall-warning"));
  }

  if (journal.length > 0) {
    lines.push(
      renderPrompt("chat/goal/progress-header", { iterationCount: goal.iteration_count }),
      ...journal.map(formatJournalEntry),
      "</progress_so_far>",
    );
  }

  lines.push("</active_goal>");

  return `${lines.join("\n")}\n`;
}

export interface StandardChatPromptOptions {
  assistantName: string;
  assistantDescription: string;
  model: AssistantModelMetadata;
  mode?: string;
  verbosity?: string;
  preferredLanguage?: string | null;
  supportsToolCalls?: boolean;
  simulatedThinking?: boolean;
  isCoding?: boolean;
  skills?: readonly SkillDisclosure[];
  memoryPolicy?: PromptMemoryPolicy;
  persona?: AssistantPersonaInput | null;
  channel?: ChannelContextInput | null;
  userContext: UserContextInput;
  skillLoadTool?: string;
  userTraits?: string | null;
  userPreferences?: string | null;
  platform?: string | null;
}

export function buildStandardChatPrompt({
  assistantName,
  assistantDescription,
  model,
  mode,
  verbosity,
  preferredLanguage,
  supportsToolCalls,
  simulatedThinking,
  isCoding = false,
  skills,
  memoryPolicy = { enabled: false, canRetrieve: false, canStore: false },
  persona,
  channel,
  userContext,
  skillLoadTool,
  userTraits,
  userPreferences,
  platform,
}: StandardChatPromptOptions): string {
  const chatMode = mode || "standard";
  const isTeammate = isAgentMode(chatMode);
  const capabilities = resolvePromptCapabilities({
    supportsToolCalls,
    simulatedThinking,
    model,
  });
  const responseStyle = getResponseStyle({
    verbosity,
    userTraits,
    userPreferences,
    isCoding,
    isTeammate,
    simulatedThinking: capabilities.simulatedThinking,
  });

  return new PromptBuilder(
    buildAssistantMetadataSection({ assistantName, assistantDescription, model }),
  )
    .addLine(buildInstructionPrecedence(isCoding))
    .addLine()
    .add(
      buildBehaviourSection({
        assistantName,
        isTeammate,
        supportsToolCalls: capabilities.supportsToolCalls,
        simulatedThinking: capabilities.simulatedThinking,
        preferredLanguage,
      }),
    )
    .add(buildPersonaSection(persona))
    .add(buildResponseStyleSection(responseStyle))
    .add(buildFormattingSection({ isCoding }))
    .addIf(isCoding, buildCodingConductSection())
    .add(buildSafetyStandardsSection())
    .addIf(isTeammate, buildAgentGuidelinesSection())
    .add(buildChannelSection(channel))
    .add(buildSkillsSection(skills, { skillLoadTool }))
    .add(buildUserContextSection(userContext))
    .add(
      buildSessionConfigSection({
        mode: chatMode,
        platform,
        verbosity,
        preferredLanguage,
        memory: memoryPolicy,
      }),
    )
    .build();
}

export const META_ASSISTANT_PLACE_LABELS: Readonly<Record<string, string>> = {
  conversations: "Conversations",
  canvas: "Canvas",
  sites: "Sites",
  attention: "Attention",
  files: "Files",
  teammates: "Teammates",
  scheduled: "Scheduled",
  plugins: "Plugins",
  you: "Account settings",
};

export const META_ASSISTANT_MODE_LABELS: Readonly<Record<string, string>> = {
  chat: "Chat",
  work: "Work",
};

export interface MetaAssistantUiContextInput {
  mode?: string | null;
  place?: string | null;
  route?: string | null;
  conversationId?: string | null;
  workspaceId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  runId?: string | null;
}

function buildUiContextSection(uiContext?: MetaAssistantUiContextInput | null): string {
  if (!uiContext) {
    return "";
  }

  const lines = [
    "<ui_context>",
    uiContext.mode
      ? `<mode>${META_ASSISTANT_MODE_LABELS[uiContext.mode] ?? uiContext.mode}</mode>`
      : null,
    uiContext.place
      ? `<place>${META_ASSISTANT_PLACE_LABELS[uiContext.place] ?? uiContext.place}</place>`
      : null,
    uiContext.route ? `<route>${escapeHtml(uiContext.route)}</route>` : null,
    uiContext.conversationId
      ? `<open_conversation_id>${escapeHtml(uiContext.conversationId)}</open_conversation_id>`
      : null,
    uiContext.workspaceId
      ? `<workspace_id>${escapeHtml(uiContext.workspaceId)}</workspace_id>`
      : null,
    uiContext.projectId ? `<project_id>${escapeHtml(uiContext.projectId)}</project_id>` : null,
    uiContext.taskId ? `<task_id>${escapeHtml(uiContext.taskId)}</task_id>` : null,
    uiContext.runId ? `<run_id>${escapeHtml(uiContext.runId)}</run_id>` : null,
    getPromptText("chat/meta-assistant/ui-context-note"),
    "</ui_context>",
  ].filter((line): line is string => Boolean(line));

  return `${lines.join("\n")}\n`;
}

export interface MetaAssistantPromptOptions {
  userReference?: string | null;
  uiContext?: MetaAssistantUiContextInput | null;
}

export function buildMetaAssistantPrompt({
  userReference,
  uiContext,
}: MetaAssistantPromptOptions): string {
  return new PromptBuilder(
    renderPrompt("chat/meta-assistant/role", {
      userReference: userReference ? escapeHtml(userReference) : undefined,
    }),
  )
    .addLine()
    .add(getPromptText("chat/meta-assistant/behaviour"))
    .addLine()
    .add(buildUiContextSection(uiContext))
    .add(buildSafetyStandardsSection())
    .build();
}

export interface SandboxContextInput {
  repository?: string | null;
  installationId?: number | null;
  taskType?: string | null;
  promptStrategy?: string | null;
  delivery: string;
  environmentSetup?: string | null;
  timeoutSeconds?: number | null;
}

export interface SandboxControllerPromptOptions {
  assistantName: string;
  assistantDescription: string;
  model: AssistantModelMetadata;
  sandbox: SandboxContextInput;
  userContext: UserContextInput;
}

function buildSandboxContext(sandbox: SandboxContextInput): string {
  const lines = [
    "<sandbox_context>",
    renderPrompt("chat/sandbox/context/repository", {
      repository: sandbox.repository ?? undefined,
    }),
    renderPrompt("chat/sandbox/context/installation", {
      installationId: sandbox.installationId ?? undefined,
    }),
    renderPrompt("chat/sandbox/context/task-type", { taskType: sandbox.taskType ?? undefined }),
    renderPrompt("chat/sandbox/context/prompt-strategy", {
      promptStrategy: sandbox.promptStrategy ?? undefined,
    }),
    renderPrompt("chat/sandbox/context/delivery", { delivery: sandbox.delivery }),
    renderPrompt("chat/sandbox/context/environment", {
      environmentSetup:
        sandbox.environmentSetup ?? getPromptText("chat/sandbox/context/environment-none"),
    }),
    renderPrompt("chat/sandbox/context/timeout", {
      timeoutSeconds: sandbox.timeoutSeconds ?? undefined,
    }),
    "</sandbox_context>",
  ];

  return lines.join("\n");
}

export function buildSandboxControllerPrompt({
  assistantName,
  assistantDescription,
  model,
  sandbox,
  userContext,
}: SandboxControllerPromptOptions): string {
  return new PromptBuilder(
    buildAssistantMetadataSection({ assistantName, assistantDescription, model }),
  )
    .addLine(getPromptText("chat/sandbox/info"))
    .addLine(getPromptText("chat/sandbox/instruction-precedence"))
    .addLine()
    .add(buildUserContextSection(userContext))
    .addLine()
    .add(buildSandboxContext(sandbox))
    .addLine()
    .addLine(getPromptText("chat/sandbox/tool-contract"))
    .addLine()
    .addLine(getPromptText("chat/sandbox/response-contract"))
    .build();
}
