import { extractImpactPayload, extractUsagePayload } from "@ngriffin_uk/polychat-ai-telemetry";
import { HOSTED_MCP_APPROVAL_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";
import type { InferenceImpact } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import { readGoogleThoughtSignature } from "../utils/googleThoughtSignatures.js";
import { extractReasoningContentBlocks } from "./content-blocks.js";

export class StreamingFormatter {
  static extractContentFromChunk(data: any, currentEventType = "") {
    if (data.choices?.[0]?.delta?.content !== undefined) {
      return extractReasoningContentBlocks(data.choices[0].delta.content).text;
    }

    if (data.type === "response.output_text.delta" && data.delta !== undefined) {
      return data.delta || "";
    }

    if (data.type === "content-delta") {
      return data.delta?.message?.content?.text || "";
    }

    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }

    if (data.candidates?.[0]?.content?.parts) {
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

      return textResponse;
    }

    if (data.delta?.type === "text_delta" && data.delta.text) {
      return data.delta.text;
    }

    if (currentEventType === "content_block_delta" && data.delta?.type === "text_delta") {
      return data.delta.text || "";
    }

    if (Array.isArray(data.message?.content)) {
      return data.message.content
        .filter((block: any) => block.type === "text" && block.text)
        .map((block: any) => block.text)
        .join("");
    }

    if (typeof data.content === "string") {
      return data.content;
    }

    if (data.response !== undefined) {
      return data.response;
    }

    if (data.message?.content) {
      return data.message.content;
    }

    if (data.text) {
      return data.text;
    }

    return "";
  }

  static extractThinkingFromChunk(data: any, currentEventType = "") {
    if (data.type === "response.reasoning_summary_text.delta" && typeof data.delta === "string") {
      return data.delta;
    }

    if (
      currentEventType === "content_block_delta" &&
      data.delta?.type === "thinking_delta" &&
      data.delta.thinking
    ) {
      return data.delta.thinking || "";
    }

    if (
      currentEventType === "content_block_delta" &&
      data.delta?.type === "signature_delta" &&
      data.delta.signature
    ) {
      return {
        type: "signature",
        signature: data.delta.signature,
      };
    }

    if (data.choices?.[0]?.delta?.reasoning_content !== undefined) {
      return data.choices[0].delta.reasoning_content || "";
    }

    if (data.choices?.[0]?.delta?.reasoning !== undefined) {
      return data.choices[0].delta.reasoning || "";
    }

    const reasoningBlocks = extractReasoningContentBlocks(data.choices?.[0]?.delta?.content);

    if (reasoningBlocks.thinking) {
      return reasoningBlocks.thinking;
    }

    if (data.type === "content-delta" && data.delta?.message?.content?.thinking) {
      return data.delta.message.content.thinking || "";
    }

    if (data.type === "tool-plan-delta" && data.delta?.message?.toolPlan) {
      return data.delta.message.toolPlan || "";
    }

    return null;
  }

  static extractToolCall(data: any, currentEventType = "") {
    const responseOutputItems =
      data.type === "response.completed" && Array.isArray(data.response?.output)
        ? data.response.output
        : data.type === "response.output_item.done" && data.item
          ? [data.item]
          : [];
    const responseFunctionCalls = responseOutputItems
      .flatMap((item: any) => {
        if (item?.type === "function_call") {
          return [
            {
              id: item.call_id || item.id,
              type: "function",
              function: {
                name: item.name,
                arguments: item.arguments || "{}",
              },
            },
          ];
        }

        if (
          item?.type === "mcp_approval_request" &&
          typeof item.id === "string" &&
          typeof item.server_label === "string" &&
          typeof item.name === "string"
        ) {
          return [
            {
              id: item.id,
              type: "function",
              function: {
                name: HOSTED_MCP_APPROVAL_TOOL_NAME,
                arguments: JSON.stringify({
                  approvalRequestId: item.id,
                  serverLabel: item.server_label,
                  toolName: item.name,
                  arguments: item.arguments,
                }),
              },
            },
          ];
        }

        return [];
      })
      .filter((toolCall: any) => toolCall.id && toolCall.function.name);

    if (responseFunctionCalls.length > 0) {
      return {
        format: "direct",
        toolCalls: responseFunctionCalls,
      };
    }

    if (data.type === "tool-call-start" && data.delta?.message?.toolCalls) {
      const toolCall = data.delta.message.toolCalls;

      return {
        format: "openai",
        toolCalls: [
          {
            index: data.index ?? 0,
            id: toolCall.id,
            type: toolCall.type || "function",
            function: {
              name: toolCall.function?.name || "",
              arguments: toolCall.function?.arguments || "",
            },
          },
        ],
      };
    }

    if (data.type === "tool-call-delta" && data.delta?.message?.toolCalls) {
      const toolCall = data.delta.message.toolCalls;

      return {
        format: "openai",
        toolCalls: [
          {
            index: data.index ?? 0,
            function: {
              arguments: toolCall.function?.arguments || "",
            },
          },
        ],
      };
    }

    if (data.choices?.[0]?.delta?.tool_calls) {
      return {
        format: "openai",
        toolCalls: data.choices[0].delta.tool_calls,
      };
    }

    if (data.candidates?.[0]?.content?.parts) {
      const parts = data.candidates[0].content.parts;
      const toolCalls = parts
        .filter((part: any) => part.functionCall)
        .map((part: any) => ({
          id: part.functionCall.id || `call_${generateId()}`,
          type: "function",
          ...(readGoogleThoughtSignature(part)
            ? { thought_signature: readGoogleThoughtSignature(part) }
            : {}),
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {}),
          },
        }));

      if (toolCalls.length > 0) {
        return {
          format: "direct",
          toolCalls: toolCalls,
        };
      }
    }

    if (currentEventType === "content_block_start" && data.content_block?.type === "tool_use") {
      return {
        format: "anthropic",
        id: data.content_block.id,
        name: data.content_block.name,
        index: data.index,
      };
    }

    if (
      currentEventType === "content_block_delta" &&
      data.delta?.type === "input_json_delta" &&
      data.index !== undefined
    ) {
      return {
        format: "anthropic_delta",
        index: data.index,
        partial_json: data.delta.partial_json || "",
      };
    }

    if (data.start?.toolUse && data.contentBlockIndex !== undefined) {
      return {
        format: "nova",
        id: data.start.toolUse.toolUseId,
        name: data.start.toolUse.name,
        index: data.contentBlockIndex,
      };
    }

    if (data.delta?.toolUse?.input && data.contentBlockIndex !== undefined) {
      return {
        format: "nova_delta",
        index: data.contentBlockIndex,
        partial_json: data.delta.toolUse.input || "",
      };
    }

    if (data.tool_calls) {
      return {
        format: "direct",
        toolCalls: data.tool_calls,
      };
    }

    return null;
  }

  static isCompletionIndicated(data: any): boolean {
    const openaiFinishReason =
      data.choices?.[0]?.finish_reason?.toLowerCase() ||
      data.choices?.[0]?.finishReason?.toLowerCase();

    if (openaiFinishReason === "stop" || openaiFinishReason === "length") {
      return true;
    }

    if (data.type === "response.completed" || data.type === "response.failed") {
      return true;
    }

    if (data.type === "message-end") {
      return true;
    }

    const googleFinishReason = data.candidates?.[0]?.finishReason?.toLowerCase();

    if (googleFinishReason === "stop" || googleFinishReason === "length") {
      return true;
    }

    const bedrockFinishReason = data.stopReason;

    if (bedrockFinishReason === "stop" || bedrockFinishReason === "length") {
      return true;
    }

    return false;
  }

  static extractUsageData(data: any): any {
    return extractUsagePayload(data);
  }

  static extractImpactData(data: any): InferenceImpact | null {
    return extractImpactPayload(data);
  }

  static extractCitations(data: any): any[] {
    if (Array.isArray(data.citations)) {
      return data.citations;
    }

    if (Array.isArray(data.message?.citations)) {
      return data.message.citations;
    }

    if (data.type === "citation-start" && data.delta?.message?.citations) {
      return [data.delta.message.citations];
    }

    if (data.candidates?.[0]?.groundingMetadata) {
      const searchGrounding = data.candidates[0].groundingMetadata;

      return [
        {
          searchGrounding: {
            ...searchGrounding,
            searchEntryPoint: {
              ...searchGrounding.searchEntryPoint,
              renderedContent: undefined,
            },
            groundingSupports: {},
          },
        },
      ];
    }

    return [];
  }

  static extractStructuredData(data: any): any {
    if (data.candidates?.[0]?.groundingMetadata) {
      const searchGrounding = data.candidates[0].groundingMetadata;

      return {
        searchGrounding: {
          ...searchGrounding,
          searchEntryPoint: {
            ...searchGrounding.searchEntryPoint,
            renderedContent: undefined,
          },
          groundingSupports: {},
        },
      };
    }

    return null;
  }

  static extractRefusalFromChunk(data: any): string | null {
    const deltaRefusal = data?.choices?.[0]?.delta?.refusal;

    if (typeof deltaRefusal === "string") {
      return deltaRefusal;
    }

    const messageRefusal = data?.choices?.[0]?.message?.refusal;

    if (typeof messageRefusal === "string") {
      return messageRefusal;
    }

    if (typeof data?.refusal === "string") {
      return data.refusal;
    }

    return null;
  }

  static extractAnnotationsFromChunk(data: any): unknown {
    if (data?.choices?.[0]?.delta?.annotations !== undefined) {
      return data.choices[0].delta.annotations;
    }

    if (data?.choices?.[0]?.message?.annotations !== undefined) {
      return data.choices[0].message.annotations;
    }

    if (data?.annotations !== undefined) {
      return data.annotations;
    }

    if (Array.isArray(data?.item?.content)) {
      const annotations = data.item.content.flatMap((content: any) =>
        Array.isArray(content?.annotations) ? content.annotations : [],
      );

      if (annotations.length) {
        return annotations;
      }
    }

    return null;
  }
}
