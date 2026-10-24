export interface MultipartInputFile {
  field: string;
  data: ArrayBuffer;
  filename: string;
  contentType: string;
}

export interface MultipartInputPayload {
  multipart: {
    body: ReadableStream<Uint8Array>;
    contentType: string;
  };
}

export async function buildMultipartInput(
  fields: Record<string, unknown>,
  files: MultipartInputFile[] = [],
): Promise<MultipartInputPayload> {
  const form = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    if (
      value === "" ||
      (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")
    ) {
      continue;
    }

    form.append(name, String(value));
  }

  for (const file of files) {
    form.append(file.field, new Blob([file.data], { type: file.contentType }), file.filename);
  }

  const encoded = new Request("https://workers-ai.invalid/", { method: "POST", body: form });
  const contentType = encoded.headers.get("content-type");

  if (!contentType || !encoded.body) {
    throw new Error("Failed to encode a multipart body");
  }

  return {
    multipart: {
      body: encoded.body,
      contentType,
    },
  };
}
