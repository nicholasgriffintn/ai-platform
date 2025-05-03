import { getAuxiliaryModel } from "~/lib/models";
import type { IFunction, IRequest } from "~/types";
import { getLogger } from "~/utils/logger";
import { AIProviderFactory } from "../../providers/factory";

const logger = getLogger({ prefix: "REASONING_FUNCTION" });

export const add_reasoning_step: IFunction = {
  name: "add_reasoning_step",
  description:
    "Adds a step to the reasoning process, allowing the AI to document its thought process and decide whether to continue with additional tool calls or provide a final answer. Use this to analyze previous tool results and determine next actions.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "The title of the reasoning step",
      },
      content: {
        type: "string",
        description:
          "The content of the reasoning step. Explain your understanding of the current state, what you've learned from previous tool calls, and what you plan to do next.",
      },
      nextStep: {
        type: "string",
        enum: ["continue", "finalAnswer"],
        description:
          "Whether to continue with another tool call or provide the final answer",
      },
    },
    required: ["title", "content", "nextStep"],
  },
  function: async (
    completion_id: string,
    args: {
      title: string;
      content: string;
      nextStep: "continue" | "finalAnswer";
    },
    req: IRequest,
  ) => {
    try {
      const reasoningPrompt = `
You are evaluating a reasoning step in a multi-step task. Review the information and decide if the proposed next action is appropriate.

# Current reasoning step
Title: ${args.title}
Content: ${args.content}
Proposed next action: ${args.nextStep === "finalAnswer" ? "Provide final answer to user" : "Continue with additional tool calls"}

# Task
1. Evaluate if the reasoning is sound and if the proposed next action makes sense
2. If needed, enhance or correct the reasoning
3. Determine if the next step should be "continue" (more tool calls needed) or "finalAnswer" (ready to respond)

Respond with:
<evaluation>Your assessment of the reasoning quality (1-3 sentences)</evaluation>
<enhanced_content>Improved reasoning if needed</enhanced_content>
<nextStep>continue OR finalAnswer</nextStep>
<confidence>high OR medium OR low</confidence>
`;

      const { model: modelToUse, provider: providerToUse } =
        await getAuxiliaryModel(req.env, req.user);
      const provider = AIProviderFactory.getProvider(providerToUse);

      const aiResponse = await provider.getResponse({
        model: modelToUse,
        messages: [
          {
            role: "user",
            content: reasoningPrompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
        stream: false,
        store: false,
        env: req.env,
      });

      if (!aiResponse.response) {
        throw new Error("AI reasoning evaluation failed");
      }

      const response = aiResponse.response;

      const evaluationMatch = /<evaluation>(.*?)<\/evaluation>/s.exec(response);
      const enhancedContentMatch =
        /<enhanced_content>(.*?)<\/enhanced_content>/s.exec(response);
      const nextStepMatch = /<nextStep>(.*?)<\/nextStep>/s.exec(response);
      const confidenceMatch = /<confidence>(.*?)<\/confidence>/s.exec(response);

      const evaluation = evaluationMatch ? evaluationMatch[1].trim() : "";
      const enhancedContent = enhancedContentMatch
        ? enhancedContentMatch[1].trim()
        : args.content;
      const nextStep = nextStepMatch ? nextStepMatch[1].trim() : args.nextStep;
      const confidence = confidenceMatch ? confidenceMatch[1].trim() : "medium";

      const validatedNextStep = ["continue", "finalAnswer"].includes(nextStep)
        ? nextStep
        : args.nextStep;

      const formattedContent = `## ${args.title} ${confidence === "high" ? "✓" : ""}

${enhancedContent}

${evaluation ? `**Evaluation**: ${evaluation}\n\n` : ""}**Next action**: ${
        validatedNextStep === "finalAnswer"
          ? "Provide final answer to the user"
          : "Continue with additional tool calls"
      }`;

      return {
        status: "success",
        name: "add_reasoning_step",
        content: formattedContent,
        data: {
          title: args.title,
          content: enhancedContent,
          nextStep: validatedNextStep,
          evaluation,
          confidence,
          reasoning_enhanced: true,
        },
      };
    } catch (error) {
      logger.error("Error in reasoning step:", error);

      return {
        status: "success",
        name: "add_reasoning_step",
        content: `## ${args.title}\n\n${args.content}\n\n**Next action**: ${
          args.nextStep === "finalAnswer"
            ? "Provide final answer to the user"
            : "Continue with additional tool calls"
        }`,
        data: {
          title: args.title,
          content: args.content,
          nextStep: args.nextStep,
          reasoning_enhanced: false,
        },
      };
    }
  },
};
