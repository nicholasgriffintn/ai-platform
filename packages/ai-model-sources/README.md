# @ngriffin_uk/polychat-ai-model-sources

Model and dataset source adapters. `HuggingFaceHubClient` resolves revisions to commits, lists files with LFS SHA-256 and per-file scanner results, reads byte ranges for static inspection, samples dataset rows through the dataset viewer and imports public eval results with their provenance.

```ts
import { HuggingFaceHubClient } from "@ngriffin_uk/polychat-ai-model-sources";

const hub = new HuggingFaceHubClient({ token });
const info = await hub.getRepoInfo({
  kind: "model",
  repo: "Qwen/Qwen2.5-0.5B-Instruct",
  revision: "main",
});
const files = await hub.listFiles({ kind: "model", repo: info.id, revision: info.sha });
```

Repository and revision strings are validated before any request is built, so a crafted reference cannot reach other Hub API paths. Failures throw `ModelSourceError` with a code (`invalid_reference`, `not_found`, `unauthorised`, `rate_limited`, `upstream_error`) for the host to map.
