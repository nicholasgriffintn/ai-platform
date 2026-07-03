import type { ParsedChatCompletionRequestBody } from "@assistant/schemas";
import type { Agent } from "~/lib/database/schema";
import type { ChatCompletionParameters, Message } from "~/types";

type CompletionAgent = Pick<Agent, "id" | "model" | "temperature" | "max_steps">;

export interface AgentCompletionRequestInput {
	agent: CompletionAgent;
	body: ParsedChatCompletionRequestBody;
	modelProvider: string;
	formattedTools: NonNullable<ChatCompletionParameters["tools"]>;
	systemPrompt: string;
}

type PreparedAgentCompletionRequest = Omit<ChatCompletionParameters, "env">;

class AgentCompletionRequestPreparer {
	constructor(private readonly input: AgentCompletionRequestInput) {}

	prepare(): PreparedAgentCompletionRequest {
		const {
			user: _requestUser,
			platform: requestPlatform,
			stop: requestStop,
			tool_choice: requestToolChoice,
			messages: requestMessages,
			...requestBody
		} = this.input.body;

		return {
			...requestBody,
			messages: requestMessages.map(
				(message): Message => ({
					...message,
					content: message.content ?? "",
				}),
			),
			system_prompt: this.input.systemPrompt,
			model: this.input.agent.model || this.input.body.model,
			provider: this.input.agent.model ? this.input.modelProvider : this.input.body.provider,
			tools: this.input.formattedTools,
			stream: false,
			mode: "agent",
			max_steps: this.input.agent.max_steps || this.input.body.max_steps || 20,
			temperature: this.resolveTemperature(),
			current_agent_id: this.input.agent.id,
			platform: requestPlatform === "obsidian" ? "api" : requestPlatform,
			stop: requestStop ? (Array.isArray(requestStop) ? requestStop : [requestStop]) : undefined,
			enabled_tools: this.input.body.enabled_tools,
			approved_tools: this.input.body.approved_tools,
			use_rag: this.input.body.use_rag,
			rag_options: this.input.body.rag_options,
			use_multi_model: this.input.body.use_multi_model,
			models: this.input.body.models,
			reasoning_effort: this.input.body.reasoning_effort ?? this.input.body.reasoning?.effort,
			verbosity: this.input.body.verbosity,
			budget_constraint: this.input.body.budget_constraint,
			parallel_tool_calls: this.input.body.parallel_tool_calls,
			response_format: this.input.body.response_format,
			tool_choice: requestToolChoice,
		};
	}

	private resolveTemperature(): number {
		const agentTemperature =
			typeof this.input.agent.temperature === "string"
				? Number.parseFloat(this.input.agent.temperature)
				: undefined;

		return Number.isFinite(agentTemperature)
			? agentTemperature
			: (this.input.body.temperature ?? 0.8);
	}
}

export function prepareAgentCompletionRequest(
	input: AgentCompletionRequestInput,
): PreparedAgentCompletionRequest {
	return new AgentCompletionRequestPreparer(input).prepare();
}
