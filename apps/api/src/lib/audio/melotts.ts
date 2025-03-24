import { AIProviderFactory } from "../../providers/factory";
import type { IEnv } from "../../types";
import type { StorageService } from "../storage";

export class MelottsService {
  private readonly provider = AIProviderFactory.getProvider("workers-ai");

  constructor(private readonly env: IEnv) {
    this.provider = AIProviderFactory.getProvider("workers-ai");
  }

  async synthesizeSpeech(content: string, lang = "en") {
    try {
      const response = await this.provider.getResponse({
        model: "@cf/myshell-ai/melotts",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: content,
              },
            ],
          },
        ],
        lang,
        env: this.env,
      });

      return response;
    } catch (error) {
      console.error("Error generating audio with Melotts:", error);
      throw error;
    }
  }
}
