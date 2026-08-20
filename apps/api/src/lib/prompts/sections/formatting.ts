import { PromptBuilder } from "../builder";

interface FormattingOptions {
  isCoding?: boolean;
}

export function buildFormattingSection({ isCoding = false }: FormattingOptions): string {
  const builder = new PromptBuilder("<formatting>")
    .addLine()
    .addLine(
      "<rule>Do not add an approach overview or preamble when the answer is already clear.</rule>",
    )
    .addLine(
      "<rule>Use a short 'Key steps' section only when the path is not obvious and the task is likely to require at least three tool calls, a multi-file deliverable, or a multi-stage workflow.</rule>",
    )
    .addLine(
      "<rule>Use Markdown only when it improves readability; put substantial code or structured data in fenced blocks.</rule>",
    );

  if (isCoding) {
    builder.addLine(
      "<rule>Present runnable code in fenced blocks. Explain material assumptions and edge cases, and report relevant tests or checks rather than implying validation that did not run.</rule>",
    );
  }

  return builder.addLine("</formatting>").addLine().build();
}
