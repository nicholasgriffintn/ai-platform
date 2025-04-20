import type {
  IEnv,
  SearchOptions,
  SearchProvider,
  SearchProviderName,
} from "~/types";
import { SearchProviderFactory } from "./factory";

export class Search {
  private static instance: Search;
  private provider: SearchProvider;
  private env: IEnv;

  private constructor(env: IEnv, providerName: SearchProviderName) {
    this.env = env;

    this.provider = SearchProviderFactory.getProvider(providerName, this.env);
  }

  public static getInstance(
    env: IEnv,
    providerName: SearchProviderName,
  ): Search {
    if (!Search.instance) {
      Search.instance = new Search(env, providerName);
    }
    return Search.instance;
  }

  async search(query: string, options?: SearchOptions) {
    return await this.provider.performWebSearch(query, options);
  }
}
