import { AIProviderFactory } from "../../providers/factory";
import type { IEnv, IUser } from "../../types";
import type { StorageService } from "../storage";

export class PollyService {
  constructor(
    private readonly env: IEnv,
    private readonly user: IUser,
  ) {}

  async synthesizeSpeech(
    content: string,
    storageService: StorageService,
    slug: string,
  ): Promise<string> {
    try {
      const provider = AIProviderFactory.getProvider("polly");

      const response = await provider.getResponse({
        model: "Ruth",
        message: content,
        env: this.env,
        messages: [],
        user: this.user,
        options: {
          slug,
          storageService,
        },
      });

      return response;
    } catch (error) {
      console.error("Error generating audio with Polly:", error);
      throw error;
    }
  }
}
