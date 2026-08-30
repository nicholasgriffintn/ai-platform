import z from "zod/v4";

import { projectFlowSchema } from "./project-tasks";

export const workspaceRoleSchema = z.enum(["owner", "admin", "member"]);
export const projectCapabilityKindSchema = z.enum(["app", "recipe", "skill", "tool", "agent"]);
export const projectCodingPromptStrategySchema = z.enum([
  "auto",
  "feature-delivery",
  "bug-fix",
  "refactor",
  "test-hardening",
]);

export const projectCodingEnvironmentSchema = z.object({
  installationId: z.number().int().positive(),
  repository: z
    .string()
    .trim()
    .min(1)
    .regex(/^[\w.-]+\/[\w.-]+$/, "Repository must be in owner/repository format"),
  promptStrategy: projectCodingPromptStrategySchema.default("auto"),
  shouldCommit: z.boolean().default(true),
  timeoutSeconds: z.number().int().min(30).max(7200).default(900),
});

export const workspaceMemberSchema = z.object({
  userId: z.number().int().positive(),
  name: z.string().nullable(),
  email: z.email(),
  avatarUrl: z.string().nullable(),
  role: workspaceRoleSchema,
  joinedAt: z.string(),
});

export const workspaceInvitationSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  email: z.email(),
  role: workspaceRoleSchema.exclude(["owner"]),
  status: z.enum(["pending", "accepted", "revoked", "expired"]),
  expiresAt: z.string(),
  createdAt: z.string(),
});

export const projectCapabilitySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  kind: projectCapabilityKindSchema,
  capabilityId: z.string(),
  configuration: z.record(z.string(), z.unknown()).default({}),
  createdBy: z.number().int().positive(),
  createdAt: z.string(),
});

export const projectSummarySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string(),
  instructions: z.string(),
  colour: z.string(),
  createdBy: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  conversationCount: z.number().int().nonnegative().default(0),
  capabilityCount: z.number().int().nonnegative().default(0),
  codingEnvironment: projectCodingEnvironmentSchema.nullable(),
});

export const workspaceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  colour: z.string(),
  role: workspaceRoleSchema,
  memberCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const workspaceDetailSchema = workspaceSummarySchema.extend({
  projects: z.array(projectSummarySchema),
  members: z.array(workspaceMemberSchema),
  invitations: z.array(workspaceInvitationSchema),
});

export const workspaceListResponseSchema = z.object({
  workspaces: z.array(workspaceSummarySchema),
});

const workspaceFields = {
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
};

export const createWorkspaceSchema = z.object({
  ...workspaceFields,
  description: workspaceFields.description.default(""),
  colour: workspaceFields.colour.default("#E8643C"),
});

export const updateWorkspaceSchema = z
  .object(workspaceFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    error: "At least one workspace field must be provided",
  });

const projectFields = {
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000),
  instructions: z.string().trim().max(8000),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
};

export const createProjectSchema = z.object({
  ...projectFields,
  description: projectFields.description.default(""),
  instructions: projectFields.instructions.default(""),
  colour: projectFields.colour.optional(),
  codingEnvironment: projectCodingEnvironmentSchema.nullable().optional(),
});

export const updateProjectSchema = z
  .object({
    ...projectFields,
    codingEnvironment: projectCodingEnvironmentSchema.nullable().optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    error: "At least one project field must be provided",
  });

export const createWorkspaceInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: workspaceRoleSchema.exclude(["owner"]).default("member"),
});

export const updateWorkspaceMemberSchema = z.object({
  role: workspaceRoleSchema.exclude(["owner"]),
});

export const transferWorkspaceOwnershipSchema = z.object({
  newOwnerUserId: z.number().int().positive(),
});

export const workspaceInvitationDeliverySchema = z.object({
  invitation: workspaceInvitationSchema,
  inviteUrl: z.url(),
});

export const acceptWorkspaceInvitationSchema = z.object({
  token: z.string().min(32).max(512),
});

export const capabilityScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("personal") }),
  z.object({ kind: z.literal("project"), projectId: z.string().min(1) }),
]);

export const addProjectCapabilitySchema = z.object({
  kind: projectCapabilityKindSchema,
  capabilityId: z.string().trim().min(1).max(160),
  configuration: z.record(z.string(), z.unknown()).default({}),
});

export const projectConversationSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  lastMessageAt: z.string().nullable(),
  messageCount: z.number().int().nonnegative(),
  createdBy: z.object({
    id: z.number().int().positive(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
});

export const projectDetailSchema = projectSummarySchema.extend({
  capabilities: z.array(projectCapabilitySchema),
  conversations: z.array(projectConversationSchema),
  flow: projectFlowSchema.nullable(),
});

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type ProjectCapabilityKind = z.infer<typeof projectCapabilityKindSchema>;
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;
export type WorkspaceInvitation = z.infer<typeof workspaceInvitationSchema>;
export type WorkspaceInvitationDelivery = z.infer<typeof workspaceInvitationDeliverySchema>;
export type ProjectCapability = z.infer<typeof projectCapabilitySchema>;
export type CapabilityScope = z.infer<typeof capabilityScopeSchema>;
export type ProjectCodingEnvironment = z.infer<typeof projectCodingEnvironmentSchema>;
export type ProjectConversation = z.infer<typeof projectConversationSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;
export type WorkspaceDetail = z.infer<typeof workspaceDetailSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateWorkspaceInvitationInput = z.infer<typeof createWorkspaceInvitationSchema>;
export type AddProjectCapabilityInput = z.infer<typeof addProjectCapabilitySchema>;
