import type { DirectoryBackupGateway } from "@cloudflare/sandbox";

import type { WorkspaceOutbound } from "./modules/sandbox/infrastructure/workspace-outbound";

declare global {
  namespace Cloudflare {
    interface GlobalProps {
      mainModule: {
        DirectoryBackupGateway: typeof DirectoryBackupGateway;
        WorkspaceOutbound: typeof WorkspaceOutbound;
      };
    }
  }
}
