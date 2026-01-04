import z from "zod/v4";

export const mcpServerSchema = z.object({
	url: z.url().meta({
		description: "The endpoint URL of the MCP server",
	}),
	type: z.enum(["sse", "stdio"]).prefault("sse").optional().meta({
		description: "Transport type for MCP connection",
	}),
	command: z.string().optional().meta({
		description: "Optional command for stdio transports",
	}),
	args: z.array(z.string()).optional().meta({
		description: "Arguments for stdio transports",
	}),
	env: z
		.array(z.object({ key: z.string(), value: z.string() }))
		.optional()
		.meta({ description: "Environment variables for the MCP process" }),
	headers: z
		.array(z.object({ key: z.string(), value: z.string() }))
		.optional()
		.meta({ description: "HTTP headers for SSE transports" }),
});

export const fewShotExampleSchema = z.object({
	input: z.string().meta({ description: "Example input" }),
	output: z.string().meta({ description: "Example output" }),
});

export const createAgentSchema = z.object({
	name: z.string().meta({ description: "Name of the agent" }),
	description: z
		.string()
		.optional()
		.meta({ description: "Optional agent description" }),
	avatar_url: z
		.url()
		.nullable()
		.optional()
		.meta({ description: "Optional avatar image URL" }),
	servers: z
		.array(mcpServerSchema)
		.optional()
		.meta({ description: "List of MCP server configurations" }),
	model: z
		.string()
		.optional()
		.meta({ description: "Model ID to use with this agent" }),
	temperature: z
		.number()
		.min(0)
		.max(1)
		.optional()
		.meta({ description: "Temperature setting for the model" }),
	max_steps: z
		.int()
		.positive()
		.optional()
		.meta({ description: "Maximum number of steps for the agent" }),
	system_prompt: z
		.string()
		.optional()
		.meta({ description: "System prompt for the agent" }),
	few_shot_examples: z
		.array(fewShotExampleSchema)
		.optional()
		.meta({ description: "Few-shot examples for the agent" }),
	enabled_tools: z
		.array(z.string())
		.optional()
		.meta({ description: "Tools enabled by default for this agent" }),
	team_id: z
		.string()
		.optional()
		.meta({ description: "Team ID this agent belongs to" }),
	team_role: z
		.string()
		.optional()
		.meta({ description: "Role of this agent within the team" }),
	is_team_agent: z
		.boolean()
		.optional()
		.prefault(false)
		.meta({ description: "Whether this is a team agent" }),
});

export const updateAgentSchema = z
	.object({
		name: z.string().optional().meta({ description: "New agent name" }),
		description: z
			.string()
			.optional()
			.meta({ description: "New agent description" }),
		avatar_url: z
			.url()
			.optional()
			.meta({ description: "New avatar URL" })
			.optional(),
		servers: z
			.array(mcpServerSchema)
			.optional()
			.meta({ description: "Updated MCP servers list" }),
		model: z
			.string()
			.optional()
			.meta({ description: "Model ID to use with this agent" }),
		temperature: z
			.number()
			.min(0)
			.max(1)
			.optional()
			.meta({ description: "Temperature setting for the model" }),
		max_steps: z
			.int()
			.positive()
			.optional()
			.meta({ description: "Maximum number of steps for the agent" }),
		system_prompt: z
			.string()
			.optional()
			.meta({ description: "System prompt for the agent" }),
		few_shot_examples: z
			.array(fewShotExampleSchema)
			.optional()
			.meta({ description: "Few-shot examples for the agent" }),
		enabled_tools: z
			.array(z.string())
			.optional()
			.meta({ description: "Tools enabled by default for this agent" }),
		team_id: z
			.string()
			.optional()
			.meta({ description: "Team ID this agent belongs to" }),
		team_role: z
			.string()
			.optional()
			.meta({ description: "Role of this agent within the team" }),
		is_team_agent: z
			.boolean()
			.optional()
			.meta({ description: "Whether this is a team agent" }),
	})
	.refine((data) => Object.keys(data).length > 0, {
		error: "At least one field must be provided",
	});
