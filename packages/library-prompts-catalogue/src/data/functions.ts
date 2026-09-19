import type { PromptEntry } from "../schema.js";

export const functionPromptEntries = [
  {
    id: "functions/text/list",
    task: "text-list",
    title: "Text list system prompt",
    description: "Builds a list, inserting the count instruction for the requested size.",
    text: "You produce lists. {{countInstruction}} Each item is a short string with no numbering.",
    variables: [
      {
        name: "countInstruction",
        description:
          "Instruction for how many list items to return, such as the all or count list fragment text.",
      },
    ],
  },
  {
    id: "functions/text/list-all",
    task: "text-list",
    variant: "all",
    title: "Text list: every relevant item",
    description: "Count instruction that asks for every relevant item.",
    text: "Return every relevant item.",
  },
  {
    id: "functions/text/list-count",
    task: "text-list",
    variant: "count",
    title: "Text list: exact count",
    description: "Count instruction that asks for exactly the requested number of items.",
    text: "Return exactly {{count}} items.",
    variables: [{ name: "count", description: "Number of list items to return." }],
  },
  {
    id: "functions/text/extract",
    task: "text-extract",
    title: "Text extraction system prompt",
    description: "Extracts the requested structure using only information present in the text.",
    text: "Extract the requested structure from the text. Only use information present in the text; leave unknown fields empty.",
  },
  {
    id: "functions/text/classify",
    task: "text-classify",
    title: "Text classification system prompt",
    description: "Constrains the model to exactly one of the provided labels.",
    text: "Classify the text as exactly one of: {{labels}}.",
    variables: [{ name: "labels", description: "Comma-separated list of allowed labels." }],
  },
  {
    id: "functions/text/summarise",
    task: "text-summarise",
    title: "Text summarise base prompt",
    description: "Base instruction for summarising text.",
    text: "Summarise the text.",
  },
  {
    id: "functions/text/summarise-style",
    task: "text-summarise",
    variant: "style",
    title: "Text summarise: style",
    description: "Optional style instruction appended to the summarise prompt.",
    text: "Style: {{style}}.",
    variables: [{ name: "style", description: "Requested summary style." }],
  },
  {
    id: "functions/text/summarise-max-words",
    task: "text-summarise",
    variant: "max-words",
    title: "Text summarise: max words",
    description: "Optional length instruction appended to the summarise prompt.",
    text: "Use at most {{maxWords}} words.",
    variables: [{ name: "maxWords", description: "Maximum number of words in the summary." }],
  },
  {
    id: "functions/text/summarise-reply-only",
    task: "text-summarise",
    variant: "reply-only",
    title: "Text summarise: reply only",
    description: "Closing instruction that keeps the reply to the summary alone.",
    text: "Reply with the summary only.",
  },
  {
    id: "functions/text/score",
    task: "text-score",
    title: "Text score system prompt",
    description:
      "Places the text on an ordered scale of described levels and answers with the level number.",
    text: "{{instructions}} Rate the text on this scale and answer with the level number only:\n{{levels}}",
    variables: [
      { name: "instructions", description: "The question the level answers." },
      { name: "levels", description: "Newline-separated level numbers with their descriptions." },
    ],
  },
  {
    id: "functions/text/verdict",
    task: "text-verdict",
    title: "Boolean verdict system prompt",
    description: "Asks for a boolean verdict on whether a statement is true.",
    text: "Decide whether the statement is true. Answer with a boolean verdict only.",
  },
  {
    id: "functions/structured/task",
    task: "structured-output",
    title: "Structured output task line",
    description: "Optional task line used by defineFunctions when the spec has a description.",
    text: "Task: {{taskDescription}}",
    variables: [
      {
        name: "taskDescription",
        description: "Description of the structured task from the function spec.",
      },
    ],
  },
  {
    id: "functions/structured/response",
    task: "structured-output",
    title: "Structured output response instruction",
    description: "Closing instruction that asks for the requested structure.",
    text: "Respond with the structure requested.",
  },
] as const satisfies readonly PromptEntry[];
