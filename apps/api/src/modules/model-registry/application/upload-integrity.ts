import type { HuggingFaceHubClient } from "@ngriffin_uk/polychat-ai-model-providers";
import { sha256Stream } from "@ngriffin_uk/polychat-utility-server/crypto";

import type { StoredUploadFile } from "../infrastructure/ModelUploadRepository";

export async function verifyPublishedUpload(
  client: HuggingFaceHubClient,
  repo: string,
  revision: string,
  expected: StoredUploadFile[],
): Promise<{ missing: string[]; mismatched: string[] }> {
  const reference = { kind: "model" as const, repo, revision };
  const published = new Map((await client.listFiles(reference)).map((file) => [file.path, file]));
  const missing: string[] = [];
  const mismatched: string[] = [];

  for (const file of expected) {
    const actual = published.get(file.path);

    if (!actual) {
      missing.push(file.path);
      continue;
    }

    if (!file.sha256 || actual.size !== file.size) {
      mismatched.push(file.path);
      continue;
    }

    let hash = actual.sha256;

    if (!hash) {
      const response = await client.openFile({ ...reference, path: file.path });

      if (!response.body) {
        throw new Error(`Published file ${file.path} has no content`);
      }

      hash = await sha256Stream(response.body);
    }

    if (hash !== file.sha256) {
      mismatched.push(file.path);
    }
  }

  return { missing, mismatched };
}
