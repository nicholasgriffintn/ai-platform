import type {
	IEnv,
	IUser,
	ResearchProviderName,
	ResearchProvider,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { ParallelResearchProvider } from "./parallel";
import { ExaResearchProvider } from "./exa";

export class ResearchProviderFactory {
	static getProvider(
		providerName: ResearchProviderName,
		env: IEnv,
		user?: IUser,
	): ResearchProvider {
		switch (providerName) {
			case "parallel":
				return new ParallelResearchProvider(env, user);
			case "exa":
				return new ExaResearchProvider(env, user);
			default:
				throw new AssistantError(
					`Unsupported research provider: ${providerName}`,
					ErrorType.CONFIGURATION_ERROR,
				);
		}
	}
}
