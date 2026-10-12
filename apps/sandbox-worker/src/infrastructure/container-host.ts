import { DirectoryBackup, Files } from "@cloudflare/sandbox";
import {
  readContainerProcess,
  readContainerProcessLogs,
  runContainerCommand,
  startContainerProcess,
  stopContainerProcess,
  waitForContainerPort,
  type ContainerCommandOutput,
  type ContainerCommandResult,
  type ContainerPortProbe,
  type ContainerProcessState,
} from "@ngriffin_uk/polychat-library-sandbox";
import type { SandboxDirectoryBackup } from "@ngriffin_uk/polychat-schemas";
import { DurableObject } from "cloudflare:workers";

import type { Env } from "../types";

export interface ContainerHostCommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  onOutput?: (output: ContainerCommandOutput) => Promise<void> | void;
}

export abstract class ContainerHost extends DurableObject<Env> {
  protected abstract readonly backupPrefix: string;

  protected abstract ensureStarted(): Promise<void>;

  protected get container(): Container {
    const container = this.ctx.container;

    if (!container) {
      throw new Error("The container binding is not configured");
    }

    return container;
  }

  protected backups(): DirectoryBackup {
    return new DirectoryBackup(this.container, this.ctx.exports.DirectoryBackupGateway, {
      binding: "BACKUP_BUCKET",
      prefix: this.backupPrefix,
    });
  }

  async exec(
    command: string,
    options: ContainerHostCommandOptions = {},
  ): Promise<ContainerCommandResult> {
    await this.ensureStarted();

    return runContainerCommand(this.container, command, options);
  }

  async readFile(path: string): Promise<string> {
    await this.ensureStarted();

    return (await new Files(this.container).readFile(path)).text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.ensureStarted();
    await new Files(this.container).writeFile(path, content);
  }

  async exists(path: string): Promise<boolean> {
    await this.ensureStarted();

    return new Files(this.container)
      .stat(path)
      .then(() => true)
      .catch(() => false);
  }

  async startProcess(params: {
    id: string;
    command: string;
    cwd?: string;
    env?: Record<string, string>;
  }): Promise<void> {
    await this.ensureStarted();
    await startContainerProcess(this.container, params);
  }

  async readProcess(id: string): Promise<ContainerProcessState> {
    return this.container.running
      ? readContainerProcess(this.container, id)
      : { id, status: "missing", exitCode: null };
  }

  async readProcessLogs(id: string, offset?: number): Promise<{ output: string; offset: number }> {
    return this.container.running
      ? readContainerProcessLogs(this.container, id, offset === undefined ? {} : { offset })
      : { output: "", offset: offset ?? 0 };
  }

  async stopProcess(id: string): Promise<void> {
    if (this.container.running) {
      await stopContainerProcess(this.container, id);
    }
  }

  async waitForPort(
    port: number,
    probe: ContainerPortProbe & { timeoutMs?: number } = {},
  ): Promise<boolean> {
    return waitForContainerPort(this.container, port, probe)
      .then(() => true)
      .catch(() => false);
  }

  async backupDirectory(params: {
    dir: string;
    name?: string;
    exclude?: readonly string[];
  }): Promise<SandboxDirectoryBackup> {
    await this.ensureStarted();

    return this.backups().backup({
      dir: params.dir,
      ...(params.name ? { name: params.name } : {}),
      ...(params.exclude ? { exclude: params.exclude } : {}),
    });
  }

  async restoreDirectory(record: SandboxDirectoryBackup, dir?: string): Promise<void> {
    await this.ensureStarted();
    await this.backups().restore(record, dir ? { dir } : {});
  }

  async destroy(): Promise<void> {
    if (this.container.running) {
      await this.container.destroy("container released");
    }

    await this.ctx.storage.deleteAll();
  }
}
