import type { ModelConfigItem } from "@assistant/schemas";

import { formatToolCalls } from "~/lib/chat/tools";
import type { ChatCompletionParameters } from "~/types";
import { hasAnyEnabledTool } from "~/utils/enabledTools";
import { AssistantError, ErrorType } from "~/utils/errors";
import { coerceStringArray, isRecord } from "~/utils/objects";
import { type OptionBag, readOptionBag, readRecordOption } from "~/utils/options";
import { getToolDefinitionName } from "~/utils/toolNames";
import { listFunctionTools } from "~/services/functions";

const TOOL_SEARCH_NAMESPACE_SIZE = 10;

export function buildOpenAIResponsesTools(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
	functionTools: any[] = [],
): any[] {
	return new OpenAIResponsesToolBuilder(params, modelConfig, functionTools).build();
}

class OpenAIResponsesToolBuilder {
	private readonly options: OptionBag;
	private readonly tools: any[] = [];
	private readonly responseFunctionTools: any[];

	constructor(
		private readonly params: ChatCompletionParameters,
		private readonly modelConfig: ModelConfigItem,
		functionTools: any[],
	) {
		this.options = readOptionBag(params.tool_options);
		this.responseFunctionTools = this.convertFunctionToolsToResponsesTools(functionTools);
	}

	build(): any[] {
		this.addWebSearch();
		this.addCodeInterpreter();
		this.addFileSearch();
		this.addMcp();
		this.addComputerUse();
		this.addImageGeneration();
		this.addHostedShell();
		this.addToolSearch();
		this.addAdditionalResponseTools();

		return this.tools;
	}

	private addWebSearch() {
		if (
			this.modelConfig.supportsSearchGrounding &&
			hasAnyEnabledTool(this.params.enabled_tools, "search_grounding", "web_search")
		) {
			this.tools.push({ type: "web_search", ...readRecordOption(this.options, "web_search") });
		}
	}

	private addCodeInterpreter() {
		if (
			this.modelConfig.supportsCodeExecution &&
			hasAnyEnabledTool(this.params.enabled_tools, "code_execution", "code_interpreter")
		) {
			const codeInterpreterOptions = readRecordOption(this.options, "code_interpreter");
			this.tools.push({
				type: "code_interpreter",
				container: codeInterpreterOptions.container || { type: "auto" },
			});
		}
	}

	private addFileSearch() {
		if (
			!this.modelConfig.supportsFileSearch ||
			!hasAnyEnabledTool(this.params.enabled_tools, "file_search")
		) {
			return;
		}

		const fileSearchOptions = readRecordOption(this.options, "file_search");
		if (fileSearchOptions.type === "file_search") {
			this.tools.push(fileSearchOptions);
			return;
		}

		const vectorStoreIds = coerceStringArray(fileSearchOptions.vector_store_ids);
		if (vectorStoreIds.length === 0) {
			throw new AssistantError(
				"OpenAI file_search requires tool_options.file_search.vector_store_ids",
				ErrorType.PARAMS_ERROR,
			);
		}

		this.tools.push({
			type: "file_search",
			vector_store_ids: vectorStoreIds,
			filters: fileSearchOptions.filters,
			max_num_results: fileSearchOptions.max_num_results,
			ranking_options: fileSearchOptions.ranking_options,
		});
	}

	private addMcp() {
		const mcpTools = this.buildMcpTools();
		if (
			!this.modelConfig.supportsMcp ||
			(!hasAnyEnabledTool(this.params.enabled_tools, "mcp", "remote_mcp") && mcpTools.length === 0)
		) {
			return;
		}

		if (mcpTools.length === 0) {
			throw new AssistantError(
				"OpenAI MCP tools require tool_options.mcp_servers",
				ErrorType.PARAMS_ERROR,
			);
		}

		this.tools.push(...mcpTools);
	}

	private addComputerUse() {
		if (
			this.modelConfig.supportsComputerUse &&
			hasAnyEnabledTool(this.params.enabled_tools, "computer_use")
		) {
			this.tools.push({
				...readRecordOption(this.options, "computer_use"),
				type: "computer",
			});
		}
	}

	private addImageGeneration() {
		if (
			this.modelConfig.supportsImageGenerationTool &&
			hasAnyEnabledTool(this.params.enabled_tools, "image_generation")
		) {
			this.tools.push({
				type: "image_generation",
				...readRecordOption(this.options, "image_generation"),
			});
		}
	}

	private addHostedShell() {
		if (
			!this.modelConfig.supportsHostedShell ||
			!hasAnyEnabledTool(this.params.enabled_tools, "hosted_shell", "shell")
		) {
			return;
		}

		const shellOptions = readRecordOption(this.options, "shell");
		this.tools.push(
			shellOptions.type === "shell"
				? shellOptions
				: {
						...shellOptions,
						type: "shell",
						environment: shellOptions.environment || { type: "container_auto" },
					},
		);
	}

	private addToolSearch() {
		if (
			!this.modelConfig.supportsToolSearch ||
			!hasAnyEnabledTool(this.params.enabled_tools, "tool_search")
		) {
			this.tools.push(...this.responseFunctionTools);
			return;
		}

		const toolSearchOptions = readRecordOption(this.options, "tool_search");
		const configuredNamespaces = this.buildConfiguredToolSearchNamespaces();
		const includeAppToolNamespaces =
			toolSearchOptions.include_app_tools !== false && toolSearchOptions.execution !== "client";
		const namespaces = includeAppToolNamespaces
			? [...configuredNamespaces, ...this.buildToolSearchNamespaces()]
			: configuredNamespaces;

		const {
			namespaces: _namespaces,
			include_app_tools: _includeAppTools,
			...toolConfig
		} = toolSearchOptions;
		this.tools.push(...this.responseFunctionTools, ...namespaces, {
			...toolConfig,
			type: "tool_search",
		});
	}

	private addAdditionalResponseTools() {
		const rawTools = this.options.responses_tools;
		if (Array.isArray(rawTools)) {
			this.tools.push(...rawTools.filter((tool): tool is Record<string, any> => isRecord(tool)));
		}
	}

	private buildMcpTools(): Record<string, any>[] {
		const serverConfigs = Array.isArray(this.options.mcp_servers) ? this.options.mcp_servers : [];

		return serverConfigs.flatMap((serverConfig): Record<string, any>[] => {
			if (!isRecord(serverConfig)) {
				return [];
			}

			if (serverConfig.type === "mcp") {
				return [serverConfig];
			}

			const serverLabel = serverConfig.server_label;
			const serverUrl = serverConfig.server_url;
			const connectorId = serverConfig.connector_id;

			if (typeof serverLabel !== "string" || (!serverUrl && !connectorId)) {
				return [];
			}

			return [
				{
					type: "mcp",
					server_label: serverLabel,
					...(typeof serverUrl === "string" ? { server_url: serverUrl } : {}),
					...(typeof connectorId === "string" ? { connector_id: connectorId } : {}),
					...(serverConfig.headers ? { headers: serverConfig.headers } : {}),
					...(serverConfig.authorization ? { authorization: serverConfig.authorization } : {}),
					...(serverConfig.allowed_tools ? { allowed_tools: serverConfig.allowed_tools } : {}),
					...(serverConfig.require_approval !== undefined
						? { require_approval: serverConfig.require_approval }
						: {}),
					...(typeof serverConfig.server_description === "string"
						? { server_description: serverConfig.server_description }
						: {}),
					...(typeof serverConfig.defer_loading === "boolean"
						? { defer_loading: serverConfig.defer_loading }
						: {}),
				},
			];
		});
	}

	private buildConfiguredToolSearchNamespaces(): Record<string, any>[] {
		const namespaces = readRecordOption(this.options, "tool_search").namespaces;
		return Array.isArray(namespaces)
			? namespaces.filter((namespace): namespace is Record<string, any> => isRecord(namespace))
			: [];
	}

	private buildToolSearchNamespaces(): any[] {
		const immediateNames = new Set(
			this.responseFunctionTools
				.map((tool) => getToolDefinitionName(tool))
				.filter((name): name is string => typeof name === "string"),
		);
		const deferredFunctions = listFunctionTools().filter((tool) => !immediateNames.has(tool.name));
		const deferredTools = this.convertFunctionToolsToResponsesTools(
			formatToolCalls("openai", deferredFunctions),
		)
			.filter((tool) => tool?.type === "function" && typeof tool.name === "string")
			.map((tool) => ({
				...tool,
				defer_loading: true,
			}));

		const namespaces = [];
		for (let index = 0; index < deferredTools.length; index += TOOL_SEARCH_NAMESPACE_SIZE) {
			const tools = deferredTools.slice(index, index + TOOL_SEARCH_NAMESPACE_SIZE);
			namespaces.push({
				type: "namespace",
				name: `assistant_tools_${Math.floor(index / TOOL_SEARCH_NAMESPACE_SIZE) + 1}`,
				description: `Assistant application tools. Includes: ${tools
					.map((tool) => tool.name)
					.join(", ")}.`,
				tools,
			});
		}

		return namespaces;
	}

	private convertFunctionToolsToResponsesTools(tools: any[] = []): any[] {
		return tools.map((tool) => {
			if (tool.type !== "function" || !tool.function) {
				return tool;
			}

			return {
				type: "function",
				name: tool.function.name,
				description: tool.function.description,
				parameters: tool.function.parameters,
				...(tool.function.strict !== undefined ? { strict: tool.function.strict } : {}),
			};
		});
	}
}
