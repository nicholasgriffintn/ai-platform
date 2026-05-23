import z from "zod/v4";
import { councilChatOptionsSchema } from "./council";
import {
	sandboxModelSettingsSchema,
	sandboxPromptStrategySchema,
	sandboxTaskTypeSchema,
} from "./sandbox";

export const homeChatModeIdSchema = z.enum(["chat", "council", "sandbox"]);

export const sandboxChatModeSettingsSchema = z.object({
	repoKey: z.string().trim().optional(),
	taskType: sandboxTaskTypeSchema.optional(),
	promptStrategy: sandboxPromptStrategySchema.optional(),
	timeoutSecondsInput: z.string().trim().optional(),
	shouldCommit: z.boolean().optional(),
});

export const conversationSandboxRequestOptionsSchema = z
	.object({
		enabled: z.boolean(),
		repo: z.string().trim().optional(),
		installationId: z.number().int().positive().optional(),
		model: z.string().trim().min(1).optional(),
		taskType: sandboxTaskTypeSchema.optional(),
		promptStrategy: sandboxPromptStrategySchema.optional(),
		shouldCommit: z.boolean().optional(),
		timeoutSeconds: z.number().int().positive().optional(),
		maxSteps: z.number().int().positive().optional(),
		modelSettings: sandboxModelSettingsSchema.optional(),
	})
	.passthrough();

export const conversationModeRequestOptionsSchema = z
	.object({
		council: councilChatOptionsSchema.optional(),
		sandbox: conversationSandboxRequestOptionsSchema.optional(),
	})
	.passthrough();

export const conversationModeMetadataSchema = z
	.object({
		mode: homeChatModeIdSchema,
		requestOptions: conversationModeRequestOptionsSchema.optional(),
		sandboxSettings: sandboxChatModeSettingsSchema.optional(),
	})
	.passthrough();

export type HomeChatModeId = z.infer<typeof homeChatModeIdSchema>;
export type SandboxChatModeSettings = z.infer<typeof sandboxChatModeSettingsSchema>;
export type ConversationModeRequestOptions = z.infer<typeof conversationModeRequestOptionsSchema>;
export type ConversationModeMetadata = z.infer<typeof conversationModeMetadataSchema>;
