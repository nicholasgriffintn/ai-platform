import { describe, expect, it } from "vitest";

import { buildOpenAIAgentsSessionBody } from "./openaiAgentsSession";

describe("OpenAI Agents sandbox adapter", () => {
  it("maps the shared hosted plan into an OpenAI session", () => {
    const body = buildOpenAIAgentsSessionBody({
      credentialBroker: {
        baseUrl: "https://api.polychat.app/apps/sandbox/credential-broker/run-123",
        expiresAt: "2026-09-12T12:00:00.000Z",
        grant: "scoped-broker-grant",
      },
      model: "gpt-6-astra",
      repo: "owner/repository",
      task: "Implement the feature",
      runId: "run-123",
      deliveryPolicy: { mode: "review_branch", destination: "pull_request" },
      environmentSetup: {
        source: "polychat",
        definition: {
          version: 1,
          setupCommands: ["pnpm install"],
          resumeCommands: [],
          runtimes: [],
          setupTimeoutSeconds: 600,
          environment: [],
        },
      },
    });
    const environment = body.environment as {
      env: Record<string, string>;
      setup_commands: Array<{ command: string; cwd?: string }>;
    };

    expect(environment.env).toEqual({
      POLYCHAT_BROKER_GRANT: "scoped-broker-grant",
      POLYCHAT_BROKER_URL: "https://api.polychat.app/apps/sandbox/credential-broker/run-123",
    });
    expect(environment.setup_commands).toEqual(
      expect.arrayContaining([
        {
          command:
            'git -c http.extraHeader="Authorization: Bearer $POLYCHAT_BROKER_GRANT" clone "$POLYCHAT_BROKER_URL/git" /workspace/repository',
        },
        { command: "pnpm install", cwd: "/workspace/repository" },
      ]),
    );
    expect(JSON.stringify(environment.setup_commands)).not.toContain("scoped-broker-grant");
    expect(body.input).toContain("create the pull request");
  });

  it("uses the shared environment preparation mode", () => {
    const body = buildOpenAIAgentsSessionBody({
      credentialBroker: {
        baseUrl: "https://api.polychat.app/apps/sandbox/credential-broker/run-123",
        expiresAt: "2026-09-12T12:00:00.000Z",
        grant: "scoped-broker-grant",
      },
      model: "gpt-6-astra",
      repo: "owner/repository",
      task: "Implement the feature",
      runId: "run-123",
      deliveryPolicy: { mode: "leave_uncommitted" },
      environmentPreparationMode: "resume",
      environmentSetup: {
        source: "polychat",
        definition: {
          version: 1,
          setupCommands: ["pnpm install"],
          resumeCommands: ["pnpm check"],
          runtimes: [],
          setupTimeoutSeconds: 600,
          environment: [],
        },
      },
    });
    const environment = body.environment as {
      setup_commands: Array<{ command: string; cwd?: string }>;
    };

    expect(environment.setup_commands).toContainEqual({
      command: "pnpm check",
      cwd: "/workspace/repository",
    });
    expect(environment.setup_commands).not.toContainEqual({
      command: "pnpm install",
      cwd: "/workspace/repository",
    });
  });

  it("routes direct delivery through the broker-owned non-force update", () => {
    const body = buildOpenAIAgentsSessionBody({
      credentialBroker: {
        baseUrl: "https://api.polychat.app/apps/sandbox/credential-broker/run-123",
        expiresAt: "2026-09-12T12:00:00.000Z",
        grant: "scoped-broker-grant",
      },
      model: "gpt-6-astra",
      repo: "owner/repository",
      task: "Implement the feature",
      runId: "run-123",
      deliveryPolicy: { mode: "commit_to_branch", targetBranch: "integration" },
    });

    expect(body.input).toContain("POST $POLYCHAT_BROKER_URL/github/deliveries");
    expect(body.input).toContain("Do not force-push");
  });
});
