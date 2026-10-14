import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const modelRegistryTagDescription = md`
# Model registry

Bring models into a workspace and decide which may be used. Every model platform route is scoped under \`/model_platform/workspaces/{workspace_id}\`.

- Browse sources and the library, import from a source or a storage bucket, or upload weights through a resumable multipart upload.
- Each version is inspected statically (safetensors and GGUF headers, a pickle opcode scan that never unpickles, chat templates, remote code and model cards) and can be inspected again.
- Workspace policies judge every version. Dry-run a policy change before saving it, and record decisions to approve what a policy flags.
`;
