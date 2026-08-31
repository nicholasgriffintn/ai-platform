import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const research: FunctionToolDescriptor = {
  name: "research",
  description:
    "Executes deep web research using the configured provider. Ideal for market analysis, due diligence, and multi-source synthesis.",
  type: "byok",
  costPerCall: 3,
  permissions: ["read"],
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      input: {
        type: "string",
        description: "Plain-text research brief. Provide this or structured_input.",
      },
      structured_input: {
        type: "object",
        description:
          "Structured input payload matching a Task API input schema. Overrides input when provided.",
      },
      provider: {
        type: "string",
        description:
          "Optional research provider identifier. Defaults to 'parallel'. Use 'exa' for Exa Research.",
        enum: ["parallel", "exa"],
      },
      processor: {
        type: "string",
        description:
          "Parallel processor to use (e.g. 'ultra', 'pro', 'core', 'base'). Only applies to the Parallel provider. Defaults to ultra.",
      },
      model: {
        type: "string",
        description:
          "Exa model to use (e.g. 'exa-research', 'exa-research-pro'). Only applies to the Exa provider. Defaults to 'exa-research'.",
        enum: ["exa-research", "exa-research-pro"],
      },
      output_mode: {
        type: "string",
        description:
          "Convenience helper for output schema. Supports 'auto' or 'text'. Ignored when task_spec_json or output_schema_json is provided. Only applies to Parallel provider.",
        enum: ["auto", "text"],
      },
      output_description: {
        type: "string",
        description: "Optional description to guide text outputs when output_mode is 'text'.",
      },
      task_spec_json: {
        type: "string",
        description:
          "Full Task API task_spec payload as JSON. Only applies to Parallel provider. Overrides output_mode/output_description when provided.",
      },
      output_schema_json: {
        type: "string",
        description:
          "JSON Schema defining the structure of the research output. Only applies to Exa provider. Must be valid JSON.",
      },
      enable_events: {
        type: "boolean",
        description: "Enable Parallel event streaming for richer internal telemetry.",
        default: false,
      },
      poll_interval_ms: {
        type: "number",
        description:
          "Polling interval in milliseconds when waiting for task completion. Defaults to 5000.",
      },
      poll_timeout_seconds: {
        type: "number",
        description: "Timeout in seconds for each result poll request. Defaults to 25.",
      },
      max_poll_attempts: {
        type: "number",
        description:
          "Maximum number of poll attempts before timing out. Defaults to 120 (~10 minutes at 5s interval).",
      },
      metadata: {
        type: "object",
        description:
          "Arbitrary metadata object to forward to Parallel. Useful for tagging or auditing.",
      },
      wait_for_completion: {
        type: "boolean",
        description:
          "Set to false to return immediately with a task handle and poll for results separately. Defaults to true for chats, false for dynamic apps.",
      },
    },
  }),
};
