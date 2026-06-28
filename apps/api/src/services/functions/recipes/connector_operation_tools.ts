import { connectorProviders } from "~/lib/providers/capabilities/connectors";
import { jsonSchemaToZod } from "../jsonSchema";
import type { ApiToolDefinition } from "../types";
import { use_recipe_connector } from "./use_recipe_connector";

const connectorOperationInputSchema = {
	type: "object",
	properties: {
		params: {
			type: "object",
			description: "Provider operation parameters.",
		},
	},
} as const;

export interface ConnectorOperationMcpDescriptor {
	name: string;
	description: string;
	input_schema: typeof connectorOperationInputSchema;
	annotations: {
		access: "read" | "write";
		provider: string;
		operation: string;
		requiresApproval: boolean;
	};
}

export function getConnectorOperationToolName(provider: string, operation: string): string {
	return `connector_${provider}_${operation}`;
}

function getConnectorOperationToolDescription(
	providerName: string,
	operationId: string,
	description: string,
) {
	return `${providerName}: ${operationId.replace(/_/g, " ")}. ${description}`;
}

export const connectorOperationTools: ApiToolDefinition[] = connectorProviders.flatMap((provider) =>
	provider.operations.map((operation) => ({
		name: getConnectorOperationToolName(provider.id, operation.id),
		description: getConnectorOperationToolDescription(
			provider.name,
			operation.id,
			provider.description,
		),
		type: "premium" as const,
		costPerCall: 0,
		permissions: ["network", operation.access],
		inputSchema: jsonSchemaToZod(connectorOperationInputSchema),
		execute: async (args, context) =>
			use_recipe_connector.execute(
				{
					provider: provider.id,
					operation: operation.id,
					params: args.params,
				},
				context,
			),
	})),
);

export function listConnectorOperationMcpDescriptors(): ConnectorOperationMcpDescriptor[] {
	return connectorProviders.flatMap((provider) =>
		provider.operations.map((operation) => ({
			name: getConnectorOperationToolName(provider.id, operation.id),
			description: getConnectorOperationToolDescription(
				provider.name,
				operation.id,
				provider.description,
			),
			input_schema: connectorOperationInputSchema,
			annotations: {
				access: operation.access,
				provider: provider.id,
				operation: operation.id,
				requiresApproval: operation.access === "write",
			},
		})),
	);
}
