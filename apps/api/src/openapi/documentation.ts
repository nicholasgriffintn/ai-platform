import { chatTagDescription } from "./content/tags/chatTagDescription";
import { codeTagDescription } from "./content/tags/codeTagDescription.js";
import { modelsTagDescription } from "./content/tags/modelsTagDescription.js";
import { agentsTagDescription } from "./content/tags/agentsTagDescription.js";
import { authTagDescription } from "./content/tags/authTagDescription.js";
import { memoriesTagDescription } from "./content/tags/memoriesTagDescription.js";
import { guardrailsTagDescription } from "./content/tags/guardrailsTagDescription.js";

export const tagDescriptions = {
  chat: chatTagDescription,
  code: codeTagDescription,
  models: modelsTagDescription,
  agents: agentsTagDescription,
  auth: authTagDescription,
  memories: memoriesTagDescription,
  guardrails: guardrailsTagDescription,
} as const;
