import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const delegateToTeamMember: FunctionToolDescriptor = {
  name: "delegate_to_team_member",
  description:
    "Call a specific team member agent to handle a task. Use this when you need specialized expertise from your team.",
  type: "normal",
  costPerCall: 0,
  permissions: ["delegate"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      agent_id: {
        type: "string",
        description: "The ID of the team member agent to call",
      },
      task_description: {
        type: "string",
        description: "Description of the task you're delegating to the team member",
      },
      context_messages: {
        type: "array",
        description: "Messages to provide as context to the team member (optional)",
      },
    },
    required: ["agent_id", "task_description"],
  }),
};

export const delegateToTeamMemberByRole: FunctionToolDescriptor = {
  name: "delegate_to_team_member_by_role",
  description:
    "Find and call a team member by their role (specialist, coordinator, member). Use when you know what type of expertise you need.",
  type: "normal",
  costPerCall: 0,
  permissions: ["delegate"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      role: {
        type: "string",
        enum: ["specialist", "coordinator", "member", "leader"],
        description: "The role of team member you need",
      },
      task_description: {
        type: "string",
        description: "Description of the task you're delegating",
      },
      context_messages: {
        type: "array",
        description: "Messages to provide as context to the team member (optional)",
      },
    },
    required: ["role", "task_description"],
  }),
};

export const getTeamMembers: FunctionToolDescriptor = {
  name: "get_team_members",
  description:
    "Get list of available team members with their roles and capabilities. Use this to see who's available for delegation.",
  type: "normal",
  costPerCall: 0,
  permissions: ["read"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {},
    required: [],
  }),
};
