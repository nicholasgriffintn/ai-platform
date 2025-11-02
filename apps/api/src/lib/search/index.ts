import type {
	IEnv,
	IUser,
	SearchOptions,
	SearchProvider,
	SearchProviderName,
} from "~/types";
import { SearchProviderFactory } from "./factory";

export class Search {
	private provider: SearchProvider;
	private env: IEnv;

	constructor(env: IEnv, providerName: SearchProviderName, user?: IUser) {
		this.env = env;

		this.provider = SearchProviderFactory.getProvider(
			providerName,
			this.env,
			user,
		);
	}

	public static getInstance(
		env: IEnv,
		providerName: SearchProviderName,
		user?: IUser,
	): Search {
		return new Search(env, providerName, user);
	}

	async search(query: string, options?: SearchOptions) {
		return await this.provider.performWebSearch(query, options);
	}
}
