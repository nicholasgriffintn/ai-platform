import type {
  IEnv,
  IUser,
  ResearchOptions,
  ResearchProvider,
  ResearchProviderName,
} from "~/types";
import { ResearchProviderFactory } from "./factory";

export class Research {
  private provider: ResearchProvider;

  constructor(env: IEnv, providerName: ResearchProviderName, user?: IUser) {
    this.provider = ResearchProviderFactory.getProvider(
      providerName,
      env,
      user,
    );
  }

  static getInstance(
    env: IEnv,
    providerName: ResearchProviderName,
    user?: IUser,
  ): Research {
    return new Research(env, providerName, user);
  }

  createTask(input: unknown, options?: ResearchOptions) {
    return this.provider.createResearchTask(input, options);
  }

  fetchRun(runId: string) {
    return this.provider.fetchResearchRun(runId);
  }

  fetchResult(runId: string, options?: ResearchOptions) {
    return this.provider.fetchResearchResult(runId, options);
  }

  run(input: unknown, options?: ResearchOptions) {
    return this.provider.performResearch(input, options);
  }
}
