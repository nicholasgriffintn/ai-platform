import { accountTagDescription } from "./content/tags/accountTagDescription.js";
import { activityTagDescription } from "./content/tags/activityTagDescription.js";
import { adminTagDescription } from "./content/tags/adminTagDescription.js";
import { approvalsTagDescription } from "./content/tags/approvalsTagDescription.js";
import { attentionTagDescription } from "./content/tags/attentionTagDescription.js";
import { audioTagDescription } from "./content/tags/audioTagDescription.js";
import { authTagDescription } from "./content/tags/authTagDescription.js";
import { benchmarksTagDescription } from "./content/tags/benchmarksTagDescription.js";
import { billingTagDescription } from "./content/tags/billingTagDescription.js";
import { capabilitiesTagDescription } from "./content/tags/capabilitiesTagDescription.js";
import { channelsTagDescription } from "./content/tags/channelsTagDescription.js";
import { chatTagDescription } from "./content/tags/chatTagDescription.js";
import { codeTagDescription } from "./content/tags/codeTagDescription.js";
import { connectionsTagDescription } from "./content/tags/connectionsTagDescription.js";
import { connectorsTagDescription } from "./content/tags/connectorsTagDescription.js";
import { conversationsTagDescription } from "./content/tags/conversationsTagDescription.js";
import { decisionsTagDescription } from "./content/tags/decisionsTagDescription.js";
import { desktopTagDescription } from "./content/tags/desktopTagDescription.js";
import { devicesTagDescription } from "./content/tags/devicesTagDescription.js";
import { documentsTagDescription } from "./content/tags/documentsTagDescription.js";
import { environmentsTagDescription } from "./content/tags/environmentsTagDescription.js";
import { experiencesTagDescription } from "./content/tags/experiencesTagDescription.js";
import { extractionsTagDescription } from "./content/tags/extractionsTagDescription.js";
import { flagsTagDescription } from "./content/tags/flagsTagDescription.js";
import { guardrailsTagDescription } from "./content/tags/guardrailsTagDescription.js";
import { jobsTagDescription } from "./content/tags/jobsTagDescription.js";
import { machinesTagDescription } from "./content/tags/machinesTagDescription.js";
import { memoryTagDescription } from "./content/tags/memoryTagDescription.js";
import { modelDatasetsTagDescription } from "./content/tags/modelDatasetsTagDescription.js";
import { modelEvaluationTagDescription } from "./content/tags/modelEvaluationTagDescription.js";
import { modelGovernanceTagDescription } from "./content/tags/modelGovernanceTagDescription.js";
import { modelRegistryTagDescription } from "./content/tags/modelRegistryTagDescription.js";
import { modelServingTagDescription } from "./content/tags/modelServingTagDescription.js";
import { modelsTagDescription } from "./content/tags/modelsTagDescription.js";
import { modelTrainingTagDescription } from "./content/tags/modelTrainingTagDescription.js";
import { notificationsTagDescription } from "./content/tags/notificationsTagDescription.js";
import { outputsTagDescription } from "./content/tags/outputsTagDescription.js";
import { petsTagDescription } from "./content/tags/petsTagDescription.js";
import { plansTagDescription } from "./content/tags/plansTagDescription.js";
import { polyTagDescription } from "./content/tags/polyTagDescription.js";
import { projectsTagDescription } from "./content/tags/projectsTagDescription.js";
import { realtimeTagDescription } from "./content/tags/realtimeTagDescription.js";
import { recipesTagDescription } from "./content/tags/recipesTagDescription.js";
import { responsesTagDescription } from "./content/tags/responsesTagDescription.js";
import { searchTagDescription } from "./content/tags/searchTagDescription.js";
import { sitesTagDescription } from "./content/tags/sitesTagDescription.js";
import { skillsTagDescription } from "./content/tags/skillsTagDescription.js";
import { sourcesTagDescription } from "./content/tags/sourcesTagDescription.js";
import { syncTagDescription } from "./content/tags/syncTagDescription.js";
import { systemTagDescription } from "./content/tags/systemTagDescription.js";
import { tasksTagDescription } from "./content/tags/tasksTagDescription.js";
import { teammatesTagDescription } from "./content/tags/teammatesTagDescription.js";
import { templatesTagDescription } from "./content/tags/templatesTagDescription.js";
import { toolsTagDescription } from "./content/tags/toolsTagDescription.js";
import { uploadsTagDescription } from "./content/tags/uploadsTagDescription.js";
import { usageTagDescription } from "./content/tags/usageTagDescription.js";
import { webhooksTagDescription } from "./content/tags/webhooksTagDescription.js";
import { workspacesTagDescription } from "./content/tags/workspacesTagDescription.js";

export const tagDescriptions = {
  auth: authTagDescription,
  responses: responsesTagDescription,
  conversations: conversationsTagDescription,
  chat: chatTagDescription,
  models: modelsTagDescription,
  tools: toolsTagDescription,
  teammates: teammatesTagDescription,
  poly: polyTagDescription,
  skills: skillsTagDescription,
  memory: memoryTagDescription,
  approvals: approvalsTagDescription,
  environments: environmentsTagDescription,
  machines: machinesTagDescription,
  jobs: jobsTagDescription,
  workspaces: workspacesTagDescription,
  projects: projectsTagDescription,
  tasks: tasksTagDescription,
  templates: templatesTagDescription,
  activity: activityTagDescription,
  attention: attentionTagDescription,
  notifications: notificationsTagDescription,
  outputs: outputsTagDescription,
  documents: documentsTagDescription,
  sources: sourcesTagDescription,
  uploads: uploadsTagDescription,
  sites: sitesTagDescription,
  capabilities: capabilitiesTagDescription,
  experiences: experiencesTagDescription,
  recipes: recipesTagDescription,
  connectors: connectorsTagDescription,
  connections: connectionsTagDescription,
  channels: channelsTagDescription,
  webhooks: webhooksTagDescription,
  decisions: decisionsTagDescription,
  extractions: extractionsTagDescription,
  code: codeTagDescription,
  audio: audioTagDescription,
  realtime: realtimeTagDescription,
  guardrails: guardrailsTagDescription,
  search: searchTagDescription,
  "model-registry": modelRegistryTagDescription,
  "model-datasets": modelDatasetsTagDescription,
  "model-training": modelTrainingTagDescription,
  "model-evaluation": modelEvaluationTagDescription,
  "model-serving": modelServingTagDescription,
  "model-governance": modelGovernanceTagDescription,
  benchmarks: benchmarksTagDescription,
  account: accountTagDescription,
  billing: billingTagDescription,
  plans: plansTagDescription,
  usage: usageTagDescription,
  devices: devicesTagDescription,
  desktop: desktopTagDescription,
  sync: syncTagDescription,
  pets: petsTagDescription,
  flags: flagsTagDescription,
  admin: adminTagDescription,
  system: systemTagDescription,
} as const;
