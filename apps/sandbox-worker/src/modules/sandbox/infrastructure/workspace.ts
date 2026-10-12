import {
  interceptContainerEgress,
  runContainerScript,
  trustContainerInterception,
  watchContainerFiles,
  type ContainerCommandResult,
  type ContainerEgressPolicy,
  type ContainerFileChange,
  type ContainerScriptLanguage,
} from "@ngriffin_uk/polychat-library-sandbox";
import {
  SANDBOX_ENVIRONMENT_CACHE_PREFIX,
  SANDBOX_WORKSPACE_INSTANCE_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import {
  ContainerHost,
  type ContainerHostCommandOptions,
} from "../../../infrastructure/container-host";
import type { WorkspaceGitBroker } from "./brokered-git";
import type { WorkspaceOutboundProps } from "./workspace-outbound";

const BLOCKED_EGRESS_KEY = "blockedEgress";
const EXPOSED_PORTS_KEY = "exposedPorts";
const EGRESS_KEY = "egress";
const MAX_RECORDED_BLOCKED_HOSTS = 20;
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export interface WorkspaceEgress {
  policy: ContainerEgressPolicy;
  gitBroker?: WorkspaceGitBroker;
}

export type WorkspaceCommandOptions = ContainerHostCommandOptions;

export class Workspace extends ContainerHost {
  protected readonly backupPrefix = SANDBOX_ENVIRONMENT_CACHE_PREFIX;
  private readonly fileWatches = new Set<AbortController>();

  private async egress(): Promise<WorkspaceEgress> {
    return (
      (await this.ctx.storage.get<WorkspaceEgress>(EGRESS_KEY)) ?? {
        policy: { mode: "list", hosts: [], readOnlyHosts: [] },
      }
    );
  }

  private async intercept(egress: WorkspaceEgress): Promise<void> {
    const props: WorkspaceOutboundProps = {
      workspaceId: this.ctx.id.toString(),
      policy: egress.policy,
      ...(egress.gitBroker ? { gitBroker: egress.gitBroker } : {}),
    };

    await interceptContainerEgress(this.container, this.ctx.exports.WorkspaceOutbound({ props }));
  }

  protected async ensureStarted(): Promise<void> {
    if (!this.container.running) {
      await this.start(await this.egress());
    }
  }

  async start(egress: WorkspaceEgress): Promise<void> {
    await this.ctx.storage.put(EGRESS_KEY, egress);

    if (this.container.running) {
      await this.intercept(egress);

      return;
    }

    this.container.start({
      image: this.container.images.code,
      enableInternet: false,
      instance: SANDBOX_WORKSPACE_INSTANCE_TYPE,
    });
    await this.backups().intercept();
    await this.intercept(egress);
    await trustContainerInterception(this.container);
    await this.container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
  }

  async setEgressPolicy(policy: ContainerEgressPolicy): Promise<void> {
    const egress = { ...(await this.egress()), policy };

    if (!this.container.running) {
      await this.start(egress);

      return;
    }

    await this.ctx.storage.put(EGRESS_KEY, egress);
    await this.intercept(egress);
  }

  async runScript(params: {
    language: ContainerScriptLanguage;
    code: string;
    cwd?: string;
  }): Promise<ContainerCommandResult> {
    await this.ensureStarted();

    return runContainerScript(this.container, params);
  }

  async exposePort(port: number): Promise<void> {
    const ports = (await this.ctx.storage.get<number[]>(EXPOSED_PORTS_KEY)) ?? [];

    if (!ports.includes(port)) {
      await this.ctx.storage.put(EXPOSED_PORTS_KEY, [...ports, port]);
    }
  }

  async unexposePort(port: number): Promise<void> {
    const ports = (await this.ctx.storage.get<number[]>(EXPOSED_PORTS_KEY)) ?? [];

    await this.ctx.storage.put(
      EXPOSED_PORTS_KEY,
      ports.filter((exposed) => exposed !== port),
    );
  }

  async forwardToPort(port: number, request: Request): Promise<Response> {
    const ports = (await this.ctx.storage.get<number[]>(EXPOSED_PORTS_KEY)) ?? [];

    if (!ports.includes(port) || !this.container.running) {
      return new Response("Preview unavailable", { status: 502 });
    }

    return this.container.getTcpPort(port).fetch(request);
  }

  async watchFiles(
    path: string,
    onChange: (change: ContainerFileChange) => Promise<void> | void,
  ): Promise<void> {
    await this.ensureStarted();
    const controller = new AbortController();

    this.fileWatches.add(controller);

    try {
      await watchContainerFiles(this.container, { path, signal: controller.signal, onChange });
    } finally {
      this.fileWatches.delete(controller);
    }
  }

  async stopFileWatches(): Promise<void> {
    for (const controller of this.fileWatches) {
      controller.abort();
    }
  }

  async recordBlockedEgress(host: string): Promise<void> {
    const hosts = (await this.ctx.storage.get<string[]>(BLOCKED_EGRESS_KEY)) ?? [];

    if (hosts.includes(host) || hosts.length >= MAX_RECORDED_BLOCKED_HOSTS) {
      return;
    }

    await this.ctx.storage.put(BLOCKED_EGRESS_KEY, [...hosts, host]);
  }

  async takeBlockedEgress(): Promise<string[]> {
    const hosts = (await this.ctx.storage.get<string[]>(BLOCKED_EGRESS_KEY)) ?? [];

    await this.ctx.storage.delete(BLOCKED_EGRESS_KEY);

    return hosts;
  }

  async destroy(): Promise<void> {
    await this.stopFileWatches();
    await super.destroy();
  }
}
