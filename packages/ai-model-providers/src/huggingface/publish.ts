import type { Fetcher } from "../http.js";
import { HuggingFaceJobsClient, type HubJobState } from "./jobs.js";

export const PUBLISH_IMAGE = "python:3.12-slim";

export const PUBLISH_SCRIPT = String.raw`
import json
import os
import urllib.request

from huggingface_hub import HfApi

files = json.loads(os.environ["POLYCHAT_FILES"])
repo = os.environ["POLYCHAT_REPOSITORY"]
kind = os.environ.get("POLYCHAT_REPO_TYPE", "model")
os.makedirs("/tmp/upload", exist_ok=True)
for item in files:
    target = os.path.join("/tmp/upload", item["path"])
    os.makedirs(os.path.dirname(target), exist_ok=True)
    urllib.request.urlretrieve(item["url"], target)
api = HfApi(token=os.environ["HF_TOKEN"])
api.create_repo(repo, repo_type=kind, private=True, exist_ok=True)
info = api.upload_folder(folder_path="/tmp/upload", repo_id=repo, repo_type=kind, commit_message=os.environ.get("POLYCHAT_MESSAGE", "Upload from Polychat"))
print("POLYCHAT_COMMIT", info.oid)
`;

export interface PublishFile {
  path: string;
  url: string;
}

export async function startHubPublishJob({
  namespace,
  token,
  fetcher,
  repository,
  repoType,
  files,
  message,
  label,
}: {
  namespace: string;
  token: string;
  fetcher: Fetcher;
  repository: string;
  repoType: "model" | "dataset";
  files: PublishFile[];
  message: string;
  label: string;
}): Promise<HubJobState> {
  return new HuggingFaceJobsClient(namespace, token, fetcher).run({
    image: PUBLISH_IMAGE,
    command: [
      "bash",
      "-lc",
      'pip install --quiet huggingface_hub==0.35.3 hf_xet && python -c "$POLYCHAT_PUBLISH_SCRIPT"',
    ],
    environment: {
      POLYCHAT_PUBLISH_SCRIPT: PUBLISH_SCRIPT,
      POLYCHAT_REPOSITORY: repository,
      POLYCHAT_REPO_TYPE: repoType,
      POLYCHAT_MESSAGE: message,
    },
    secrets: { HF_TOKEN: token, POLYCHAT_FILES: JSON.stringify(files) },
    flavour: "cpu-upgrade",
    timeoutSeconds: 4 * 60 * 60,
    labels: { "polychat-upload": label },
  });
}
