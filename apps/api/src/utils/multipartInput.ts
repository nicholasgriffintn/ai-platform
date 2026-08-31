export interface MultipartInputFile {
  field: string;
  data: ArrayBuffer;
  filename: string;
  contentType: string;
}

export interface MultipartInputPayload {
  multipart: {
    body: ArrayBuffer;
    contentType: string;
  };
}

/**
 * Some Workers AI models declare `{ multipart: { body, contentType } }` rather than a JSON
 * body, meaning they want a real multipart/form-data payload. Round-tripping FormData through
 * a Request is the only way to get the encoded bytes and their generated boundary together.
 */
export async function buildMultipartInput(
  fields: Record<string, string | number | undefined>,
  files: MultipartInputFile[] = [],
): Promise<MultipartInputPayload> {
  const form = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    form.append(name, String(value));
  }

  for (const file of files) {
    form.append(file.field, new Blob([file.data], { type: file.contentType }), file.filename);
  }

  const encoded = new Request("https://workers-ai.invalid/", { method: "POST", body: form });
  const contentType = encoded.headers.get("content-type");

  if (!contentType) {
    throw new Error("Failed to encode a multipart body");
  }

  return {
    multipart: {
      body: await encoded.arrayBuffer(),
      contentType,
    },
  };
}
