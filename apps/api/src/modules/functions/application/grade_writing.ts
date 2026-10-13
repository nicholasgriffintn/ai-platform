import type z from "zod/v4";

import {
  EDITORIAL_DIMENSIONS,
  gradeEditorialQuality,
} from "~/modules/documents/application/editorial-quality";
import type { ApiToolDefinition, ApiToolExecutionContext } from "~/types/functions";

import { grade_writing as gradeWritingDescriptor } from "./definitions/grade_writing";

function percentage(value: number): number {
  return Math.round(value * 100);
}

export const grade_writing = {
  ...gradeWritingDescriptor,
  execute: async (
    args: z.infer<typeof gradeWritingDescriptor.inputSchema>,
    context: ApiToolExecutionContext,
  ) => {
    const result = await gradeEditorialQuality({
      env: context.request.env,
      user: context.request.user,
      completionId: context.completionId,
      text: args.text,
    });

    if (!result) {
      return {
        status: "error" as const,
        name: "grade_writing",
        content: "Grading needs a decision model, and none is available for this account.",
        data: {},
      };
    }

    const lines = EDITORIAL_DIMENSIONS.map(
      (dimension) => `${dimension.replace(/_/g, " ")}: ${percentage(result.dimensions[dimension])}`,
    );

    return {
      status: "success" as const,
      name: "grade_writing",
      content: [`Overall ${result.grade} (${percentage(result.overall)})`, ...lines].join("\n"),
      data: {
        renderer: "editorial_grade",
        grade: result.grade,
        overall: result.overall,
        dimensions: result.dimensions,
        confidence: result.confidence,
        provider: result.provider,
        model: result.model,
      },
    };
  },
} satisfies ApiToolDefinition;
