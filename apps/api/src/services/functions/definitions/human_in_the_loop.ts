import {
  USER_QUESTION_MAX_OPTIONS,
  USER_QUESTION_SET_MAX_QUESTIONS,
} from "@ngriffin_uk/polychat-schemas";

import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const request_approval: FunctionToolDescriptor = {
  name: "request_approval",
  description:
    "Request human approval before proceeding with an action. Use this for critical operations, irreversible changes, or when user confirmation is needed. Returns approval/rejection status.",
  type: "normal",
  costPerCall: 0,
  maxIdenticalCalls: 1,
  permissions: ["human"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      message: {
        type: "string",
        description:
          "The approval message to show the user. Clearly explain what action requires approval and its consequences.",
      },
      options: {
        type: "array",
        description: "Optional array of approval options. Defaults to ['Approve', 'Reject']",
        items: {
          type: "string",
        },
      },
      context: {
        type: "object",
        description: "Optional context data about what's being approved (for logging/auditing)",
      },
    },
    required: ["message"],
  }),
};

export const ask_user: FunctionToolDescriptor = {
  name: "ask_user",
  description:
    "Ask the user up to three concise questions and wait for their response. Use this only when missing information or an unresolved decision prevents progress, never to ask the user to approve or confirm your output. Reuse answers already present in the conversation. Offer useful choices where possible and allow a written answer when the choices are incomplete.",
  type: "normal",
  costPerCall: 0,
  maxIdenticalCalls: 1,
  permissions: ["human"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      questions: {
        type: "array",
        description:
          "One to three questions that can be answered together. Every item must use the exact fields id and prompt. Options use label and may include description.",
        minItems: 1,
        maxItems: USER_QUESTION_SET_MAX_QUESTIONS,
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description:
                "A stable lowercase identifier for this decision, such as pricing or audience. Reuse the same identifier if referring to the same decision again.",
            },
            prompt: {
              type: "string",
              description: "A clear, specific question that explains the decision needed.",
            },
            options: {
              type: "array",
              maxItems: USER_QUESTION_MAX_OPTIONS,
              description: "Useful choices. Omit when a free-form answer is more appropriate.",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  description: { type: "string" },
                },
                required: ["label"],
              },
            },
            allowOther: {
              type: "boolean",
              description: "Allow a written answer in addition to the choices. Defaults to true.",
            },
          },
          required: ["id", "prompt"],
        },
      },
    },
    required: ["questions"],
  }),
};
