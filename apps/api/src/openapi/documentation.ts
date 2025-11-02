import { chatTagDescription } from "./content/tags/chatTagDescription";
import { codeTagDescription } from "./content/tags/codeTagDescription.js";
import { modelsTagDescription } from "./content/tags/modelsTagDescription.js";
import { agentsTagDescription } from "./content/tags/agentsTagDescription.js";
import { authTagDescription } from "./content/tags/authTagDescription.js";
import { memoriesTagDescription } from "./content/tags/memoriesTagDescription.js";
import { guardrailsTagDescription } from "./content/tags/guardrailsTagDescription.js";
import { adminTagDescription } from "./content/tags/adminTagDescription.js";
import { appsTagDescription } from "./content/tags/appsTagDescription.js";
import { audioTagDescription } from "./content/tags/audioTagDescription.js";
import { dynamicAppsTagDescription } from "./content/tags/dynamicAppsTagDescription.js";
import { plansTagDescription } from "./content/tags/plansTagDescription.js";
import { realtimeTagDescription } from "./content/tags/realtimeTagDescription.js";
import { searchTagDescription } from "./content/tags/searchTagDescription.js";
import { stripeTagDescription } from "./content/tags/stripeTagDescription.js";
import { toolsTagDescription } from "./content/tags/toolsTagDescription.js";
import { uploadsTagDescription } from "./content/tags/uploadsTagDescription.js";
import { userTagDescription } from "./content/tags/userTagDescription.js";
import { systemTagDescription } from "./content/tags/systemTagDescription.js";

export const tagDescriptions = {
	admin: adminTagDescription,
	agents: agentsTagDescription,
	apps: appsTagDescription,
	audio: audioTagDescription,
	auth: authTagDescription,
	chat: chatTagDescription,
	code: codeTagDescription,
	guardrails: guardrailsTagDescription,
	memories: memoriesTagDescription,
	models: modelsTagDescription,
	plans: plansTagDescription,
	realtime: realtimeTagDescription,
	search: searchTagDescription,
	stripe: stripeTagDescription,
	tools: toolsTagDescription,
	uploads: uploadsTagDescription,
	user: userTagDescription,
	"dynamic-apps": dynamicAppsTagDescription,
	system: systemTagDescription,
} as const;
