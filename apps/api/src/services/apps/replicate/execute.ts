import type { IEnv, IUser } from "~/types";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { executeModelGeneration } from "~/services/apps/generation/execute";
import { hasUserProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface ExecuteReplicateModelParams {
	modelId: string;
	input: Record<string, unknown>;
	replicateWaitSeconds?: number;
}

export interface ExecuteReplicateModelRequest {
	context?: ServiceContext;
	env?: IEnv;
	params: ExecuteReplicateModelParams;
	user: IUser;
	app_url?: string;
	storage?: {
		appId?: string;
		itemType?: string;
		extraData?: Record<string, unknown>;
	};
}

export const executeReplicateModel = async (req: ExecuteReplicateModelRequest) => {
	const { storage } = req;
	const env = req.context?.env ?? req.env;

	if (!env) {
		throw new AssistantError("Environment is required", ErrorType.CONFIGURATION_ERROR);
	}

	if (
		req.user.plan_id !== "pro" &&
		!(await hasUserProviderApiKey({ env, user: req.user, providerName: "replicate" }))
	) {
		throw new AssistantError(
			"Replicate generation requires a configured replicate provider key",
			ErrorType.AUTHORISATION_ERROR,
			403,
		);
	}

	return executeModelGeneration({
		context: req.context,
		env: req.env,
		user: req.user,
		app_url: req.app_url,
		params: {
			modelId: req.params.modelId,
			input: req.params.input,
			providerWaitSeconds: req.params.replicateWaitSeconds,
		},
		storage: {
			appId: storage?.appId ?? "replicate",
			itemType: storage?.itemType ?? "prediction",
			extraData: storage?.extraData,
			pollingTaskType: "replicate_polling",
		},
	});
};
