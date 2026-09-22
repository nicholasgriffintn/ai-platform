import {
  teammateComputerInputSchema,
  type TeammateComputerInput,
} from "@ngriffin_uk/polychat-schemas";
import { invoke } from "@tauri-apps/api/core";
import z from "zod/v4";

const browserObservationSchema = z.record(z.string(), z.unknown());

export interface LocalBrowserBackend {
  localBrowserAvailable(): Promise<boolean>;
  startLocalBrowser(id: string): Promise<string>;
  localBrowserAction(
    id: string,
    fence: number,
    input: TeammateComputerInput,
  ): Promise<Record<string, unknown>>;
  observeLocalBrowser(id: string, fence: number): Promise<Record<string, unknown>>;
  revokeLocalBrowser(id: string, fence: number): Promise<void>;
  stopLocalBrowser(id: string, fence: number): Promise<void>;
}

export const tauriLocalBrowserBackend: LocalBrowserBackend = {
  localBrowserAvailable: async () => z.boolean().parse(await invoke("local_browser_available")),
  startLocalBrowser: async (id) => z.string().parse(await invoke("start_local_browser", { id })),
  localBrowserAction: async (id, fence, input) =>
    browserObservationSchema.parse(
      await invoke("local_browser_action", {
        id,
        fence,
        input: teammateComputerInputSchema.parse(input),
      }),
    ),
  observeLocalBrowser: async (id, fence) =>
    browserObservationSchema.parse(await invoke("observe_local_browser", { id, fence })),
  revokeLocalBrowser: async (id, fence) => {
    await invoke("revoke_local_browser", { id, fence });
  },
  stopLocalBrowser: async (id, fence) => {
    await invoke("stop_local_browser", { id, fence });
  },
};
