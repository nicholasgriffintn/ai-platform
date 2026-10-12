import { Files } from "@cloudflare/sandbox";
import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";

import { ContainerHost } from "../../infrastructure/container-host";
import { COMPUTER_INSTANCE_TYPE, COMPUTER_PROFILE_BACKUP_PREFIX, SCREEN_PORT } from "./config";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export class Computer extends ContainerHost {
  protected readonly backupPrefix = COMPUTER_PROFILE_BACKUP_PREFIX;

  protected async ensureStarted(): Promise<void> {
    if (this.container.running) {
      return;
    }

    this.container.start({
      image: this.container.images.browser,
      enableInternet: true,
      instance: COMPUTER_INSTANCE_TYPE,
    });
    await this.backups().intercept();
    await this.container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
  }

  async readFileBase64(path: string): Promise<string> {
    await this.ensureStarted();
    const response = await new Files(this.container).readFile(path);

    return bufferToBase64(await response.arrayBuffer());
  }

  async forwardScreen(request: Request): Promise<Response> {
    if (!this.container.running) {
      return new Response("Screen unavailable", { status: 502 });
    }

    return this.container.getTcpPort(SCREEN_PORT).fetch(request);
  }
}
