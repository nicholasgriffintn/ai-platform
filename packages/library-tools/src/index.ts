export {
  declareTool,
  getToolDeclarationNames,
  isToolDeclaration,
  type ToolDeclaration,
  type ToolDeclarationInput,
} from "./declaration.js";
export {
  AGENT_CONTROL_TOOL_NAMES,
  FINISH_TOOL_NAME,
  finishToolDeclaration,
  teammateControlToolDeclarations,
  UPDATE_PLAN_TOOL_NAME,
  updatePlanToolDeclaration,
} from "./control-tools.js";
export { ToolError, isToolError, type ToolErrorCode, type ToolValidationIssue } from "./errors.js";
export { flattenObjectRootSchema } from "./json-schema.js";
export { jsonSchemaToZod } from "./json-schema-to-zod.js";
export {
  toProviderToolDeclaration,
  toProviderToolDeclarations,
  type AnthropicToolDeclaration,
  type BedrockToolDeclaration,
  type ProviderToolDeclaration,
} from "./provider-declarations.js";
export {
  PermissionChecker,
  resolveModeMaxSteps,
  resolveToolPermissions,
  type PermissionCheckInput,
  type PermissionCheckResult,
  type RequestPermissionCheckInput,
  type RequestPermissionCheckResult,
  type ToolAccessSubject,
} from "./permissions.js";
export {
  defineTool,
  toToolDeclaration,
  type AnyToolExecutionContext,
  type ToolDefinition,
  type ToolDescriptor,
  type ToolExecutionContext,
  type ToolResult,
  type ToolType,
} from "./tool.js";
export {
  ToolRegistry,
  type ToolLifecycle,
  type ToolRegistration,
  type ToolSummary,
} from "./registry.js";
export { createToolCatalogue, requireToolPermissions, type ToolCatalogue } from "./catalogue.js";
export { executeTool, validateToolInput } from "./execution.js";
