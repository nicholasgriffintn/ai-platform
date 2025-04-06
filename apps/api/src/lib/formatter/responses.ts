interface ResponseFormatOptions {
  model?: string;
  type?: string[];
}

/**
 * Formats responses from any provider
 * Handles specific response formats for each provider
 */
// biome-ignore lint/complexity/noStaticOnlyClass: CBA
export class ResponseFormatter {
  /**
   * Format a response from any provider
   */
  static formatResponse(
    data: any,
    provider: string,
    options: ResponseFormatOptions = {},
  ): any {
    const formatter = ResponseFormatter.getFormatter(provider);
    return formatter(data, options);
  }

  /**
   * Get the appropriate formatter function for a provider
   */
  private static getFormatter(
    provider: string,
  ): (data: any, options: ResponseFormatOptions) => any {
    const formatters: Record<
      string,
      (data: any, options: ResponseFormatOptions) => any
    > = {
      openai: ResponseFormatter.formatOpenAIResponse,
      anthropic: ResponseFormatter.formatAnthropicResponse,
      "google-ai-studio": ResponseFormatter.formatGoogleStudioResponse,
      ollama: ResponseFormatter.formatOllamaResponse,
      bedrock: ResponseFormatter.formatBedrockResponse,
      workers: ResponseFormatter.formatWorkersResponse,
      openrouter: ResponseFormatter.formatOpenRouterResponse,
      groq: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      mistral: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      "perplexity-ai": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      deepseek: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      huggingface: ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      "github-models": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
      "together-ai": ResponseFormatter.formatOpenAIResponse, // Uses OpenAI format
    };

    return formatters[provider] || ResponseFormatter.formatGenericResponse;
  }

  /**
   * Format generic/unknown provider responses
   * Attempts to extract content from common response formats
   */
  private static formatGenericResponse(data: any): any {
    // Handle the most common response shapes
    if (data.response !== undefined) {
      return data; // Already has response field
    }

    if (data.choices?.[0]) {
      if (data.choices[0].message?.content) {
        return { ...data, response: data.choices[0].message.content };
      }
      if (data.choices[0].delta?.content !== undefined) {
        return { ...data, response: data.choices[0].delta.content || "" };
      }
      if (data.choices[0].text) {
        return { ...data, response: data.choices[0].text };
      }
    }

    if (data.delta?.text) {
      return { ...data, response: data.delta.text };
    }

    if (data.content && typeof data.content === "string") {
      return { ...data, response: data.content };
    }

    if (data.content && Array.isArray(data.content)) {
      const textContent = data.content
        .filter((item: any) => item.type === "text" && item.text)
        .map((item: any) => item.text)
        .join(" ");

      const thinkingContent = data.content.find(
        (item: any) => item.type === "thinking" && item.thinking,
      );

      return {
        ...data,
        response: textContent || "",
        thinking: thinkingContent?.thinking || "",
        signature: thinkingContent?.signature || "",
      };
    }

    if (data.message?.content) {
      if (typeof data.message.content === "string") {
        return { ...data, response: data.message.content };
      }
      if (Array.isArray(data.message.content)) {
        const textContent = data.message.content
          .filter((item: any) => item.type === "text" && item.text)
          .map((item: any) => item.text)
          .join(" ");

        const thinkingContent = data.message.content.find(
          (item: any) => item.type === "thinking" && item.thinking,
        );

        return {
          ...data,
          response: textContent || "",
          thinking: thinkingContent?.thinking || "",
          signature: thinkingContent?.signature || "",
        };
      }
    }

    // Last resort fallback
    return { ...data, response: "" };
  }

  private static formatOpenAIResponse(data: any): any {
    const message = data.choices?.[0]?.message;
    return { ...data, response: message?.content || "", ...message };
  }

  private static formatOpenRouterResponse(data: any): any {
    const message = data.choices?.[0]?.message;
    const content = message?.content || "";

    return {
      ...data,
      response: content,
    };
  }

  private static formatAnthropicResponse(data: any): any {
    if (!data.content) {
      return { ...data, response: "" };
    }

    // Extract text content from all text blocks
    const textContent = data.content
      .filter((content: any) => content.type === "text" && content.text)
      .map((content: any) => content.text)
      .join(" ");

    // Check for thinking content
    const thinkingContent = data.content.find(
      (content: any) => content.type === "thinking" && content.thinking,
    );

    // Return formatted response
    return {
      ...data,
      response: textContent,
      thinking: thinkingContent?.thinking || "",
      signature: thinkingContent?.signature || "",
    };
  }

  private static formatGoogleStudioResponse(data: any): any {
    if (!data.candidates || !data.candidates[0]?.content?.parts) {
      return { ...data, response: "" };
    }

    const parts = data.candidates[0].content.parts;

    let textResponse = "";

    parts.forEach((part: any, index: number) => {
      if (part.text) {
        textResponse += (textResponse ? "\n" : "") + part.text;
      } else if (part.executableCode) {
        const code = part.executableCode;
        const language = code.language?.toLowerCase() || "code";
        textResponse += `\n\n<artifact identifier="executable-code-${index}" type="application/code" language="${language}" title="Executable ${language} Code">${code.code}</artifact>`;
      } else if (part.codeExecutionResult) {
        const result = part.codeExecutionResult;
        if (result.output) {
          textResponse += `\n\n${result.output}\n\n`;
        }
      }
    });

    let newData = data.data;
    const searchGrounding = data.candidates[0].groundingMetadata;
    if (searchGrounding) {
      if (!newData) {
        newData = {};
      }

      // Remove the searchEntryPoint renderedContent and groundingSupports from the searchGrounding
      const cleanedSearchGrounding = {
        ...searchGrounding,
        searchEntryPoint: {
          ...searchGrounding.searchEntryPoint,
          renderedContent: undefined,
        },
        groundingSupports: {},
      };

      newData.searchGrounding = cleanedSearchGrounding;
    }

    return { ...data, response: textResponse, data: newData };
  }

  private static formatOllamaResponse(data: any): any {
    return { ...data, response: data.message?.content || "" };
  }

  private static formatWorkersResponse(data: any): any {
    if (data.response) {
      return data;
    }

    return { ...data, response: data.result || "" };
  }

  private static formatBedrockResponse(
    data: any,
    options: ResponseFormatOptions = {},
  ): any {
    const type = options.type || ["text"];
    const isImageType =
      type.includes("text-to-image") || type.includes("image-to-image");
    const isVideoType =
      type.includes("text-to-video") || type.includes("image-to-video");

    if (isVideoType) {
      return { ...data, response: data };
    }

    if (isImageType && data.images) {
      return {
        ...data,
        response: `Image Generated: [${Math.random().toString(36)}]`,
      };
    }

    if (data.output?.message?.content?.[0]?.text) {
      return { ...data, response: data.output.message.content[0].text };
    }

    return { ...data, response: "No content returned" };
  }
}
