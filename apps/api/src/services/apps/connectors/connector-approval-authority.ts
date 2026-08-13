import type {
	RecipeChatRequestOptions,
	RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ConnectorOperationApprovalRecord } from "~/repositories/ConnectorOperationApprovalRepository";

export interface StoredConnectorOperationCall {
	provider: RecipeConnectorProvider;
	operation: string;
	params?: Record<string, unknown>;
	sessionId: string;
}

export interface ConnectorApprovalExecutionAuthority {
	arguments: Record<string, unknown>;
	requestOptions: { recipe?: RecipeChatRequestOptions };
	projectId?: string;
}

export type ResolveConnectorApprovalAuthority = (params: {
	approval: ConnectorOperationApprovalRecord;
	call: StoredConnectorOperationCall;
	context: ServiceContext;
	userId: number;
}) => Promise<ConnectorApprovalExecutionAuthority>;
