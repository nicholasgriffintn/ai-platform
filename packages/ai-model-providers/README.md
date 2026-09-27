# @ngriffin_uk/polychat-ai-model-providers

Use capability manifests to select model trainers and hosts before creating provider resources. This package also supplies connection checks, hosting lifecycle operations, training recipes and Hugging Face model and dataset source adapters.

Read `pauseSupported` and `scaleToZero` independently. Vertex endpoints cannot pause; delete them to stop dedicated compute. Hosts that cannot pause cannot enforce Polychat hard-stop or idle-pause budgets.

Keep polling dedicated deployments until the provider confirms deletion. A provisioning operation reference is not yet a deployable endpoint, and accepting a delete request does not confirm that compute has stopped.

Use `HuggingFaceHubClient` to resolve revisions to commits, list files with LFS SHA-256 and scanner results, read byte ranges for static inspection, sample dataset rows and import public evaluation results with their provenance.

```ts
import { HuggingFaceHubClient } from "@ngriffin_uk/polychat-ai-model-providers";

const hub = new HuggingFaceHubClient({ token });
const info = await hub.getRepoInfo({
  kind: "model",
  repo: "Qwen/Qwen2.5-0.5B-Instruct",
  revision: "main",
});
const files = await hub.listFiles({ kind: "model", repo: info.id, revision: info.sha });
```

Repository and revision strings are validated before requests are built. Map `ModelProviderError` codes at the application boundary and preserve uncertain provider outcomes for reconciliation before retrying resource creation.
