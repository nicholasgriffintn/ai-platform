import {
  readArray,
  readFiniteNumber,
  readNonEmptyString,
  readRecord,
} from "@ngriffin_uk/polychat-utility-core";

import { unsupported } from "./errors.js";
import { type Fetcher, JsonHttpClient, streamingMultipart } from "./http.js";
import type { ChatInvocation, ChatInvocationResult, DatasetHandle } from "./types.js";

export function chatCompletionBody(model: string | null, request: ChatInvocation) {
  return {
    ...(model ? { model } : {}),
    messages: request.messages,
    max_tokens: request.maxTokens,
    temperature: request.temperature,
    ...(request.topP === undefined ? {} : { top_p: request.topP }),
    ...(request.stop?.length ? { stop: request.stop } : {}),
    stream: false,
  };
}

export function readChatCompletion(body: unknown): ChatInvocationResult {
  const record = readRecord(body);
  const choice = readRecord(readArray(record.choices)[0]);
  const message = readRecord(choice.message);
  const usage = readRecord(record.usage);
  const content = message.content;

  return {
    text:
      typeof content === "string"
        ? content
        : readArray(content)
            .map((part) => readRecord(part).text)
            .filter((part): part is string => typeof part === "string")
            .join(""),
    inputTokens: readFiniteNumber(usage.prompt_tokens) ?? 0,
    outputTokens: readFiniteNumber(usage.completion_tokens) ?? 0,
  };
}

export async function invokeOpenAiCompatible({
  baseUrl,
  headers,
  model,
  request,
  fetcher,
  context,
}: {
  baseUrl: string;
  headers: Record<string, string>;
  model: string | null;
  request: ChatInvocation;
  fetcher: Fetcher;
  context: string;
}): Promise<ChatInvocationResult> {
  const client = new JsonHttpClient(baseUrl.replace(/\/$/, ""), () => headers, fetcher);

  return readChatCompletion(
    await client.json("/chat/completions", {
      method: "POST",
      body: chatCompletionBody(model, request),
      context,
    }),
  );
}

export async function uploadOpenAiStyleFile(
  http: JsonHttpClient,
  path: string,
  dataset: DatasetHandle,
  fields: Record<string, string>,
  context: string,
): Promise<string> {
  const multipart = streamingMultipart(fields, {
    field: "file",
    filename: dataset.file.filename,
    contentType: "application/jsonl",
    stream: await dataset.file.open(),
  });
  const body = await http.record(path, {
    method: "POST",
    rawBody: multipart.body,
    headers: { "Content-Type": multipart.contentType },
    context,
  });
  const id = readNonEmptyString(body.id);

  if (!id) {
    throw unsupported(`${context} returned no file id`);
  }

  return id;
}
