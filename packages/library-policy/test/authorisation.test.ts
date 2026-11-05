import { describe, expect, it } from "vitest";

import {
  actionSchema,
  authorisationBundle,
  authorise,
  createAuthorisationPass,
  createAuthorizer,
  ownsResource,
  stringAttribute,
} from "../src/index.js";

describe("Cedar authorisation", () => {
  it("keeps ownership, workspace membership and role authority separate", () => {
    expect(ownsResource(7, 7)).toBe(true);
    expect(ownsResource(7, "7")).toBe(false);
    expect(ownsResource(undefined, undefined)).toBe(false);
    expect(ownsResource(7, 8)).toBe(false);
    const context = {
      actorId: "7",
      ownerId: "8",
      scope: "project" as const,
      member: true,
      role: "member",
    };

    expect(authorise("resource.read", context).allowed).toBe(true);
    expect(authorise("resource.write", context).allowed).toBe(false);
    expect(authorise("resource.write", { ...context, ownerId: "7" }).allowed).toBe(true);
    expect(authorise("resource.write", { ...context, role: "admin" }).allowed).toBe(true);
    expect(authorise("resource.read", { ...context, member: false }).allowed).toBe(false);
    expect(authorise("resource.write", { ...context, role: "unknown" }).allowed).toBe(false);
  });

  it("keeps knowledge settings, knowledge bases and confidential retrieval with the right people", () => {
    const member = {
      actorId: "7",
      ownerId: "8",
      scope: "project" as const,
      member: true,
      role: "member",
    };

    expect(authorise("knowledge.configure", member).allowed).toBe(false);
    expect(authorise("knowledge.configure", { ...member, role: "admin" }).allowed).toBe(true);
    expect(
      authorise("knowledge.configure", { ...member, scope: "personal", ownerId: "7" }).allowed,
    ).toBe(true);
    expect(
      authorise("knowledge.attach", { connected: true, member: true, role: "member" }).allowed,
    ).toBe(false);
    expect(
      authorise("knowledge.attach", { connected: false, member: true, role: "owner" }).allowed,
    ).toBe(false);
    expect(
      authorise("knowledge.retrieve", {
        retrieval: "included",
        sensitivity: "confidential",
        teammate: true,
      }).allowed,
    ).toBe(false);
    expect(
      authorise("knowledge.retrieve", {
        retrieval: "included",
        sensitivity: "confidential",
        teammate: false,
      }).allowed,
    ).toBe(true);
    expect(
      authorise("knowledge.retrieve", { retrieval: "excluded", sensitivity: "", teammate: false })
        .allowed,
    ).toBe(false);
  });

  it("prevents project sharing and cross-user teammate conversation access", () => {
    expect(
      authorise("conversation.share", { actorId: "7", ownerId: "7", project: false }).allowed,
    ).toBe(true);
    expect(
      authorise("conversation.share", { actorId: "7", ownerId: "7", project: true }).allowed,
    ).toBe(false);
    const conversation = {
      actorId: "7",
      ownerId: "8",
      project: true,
      member: true,
      plan: "pro",
      teammateActorId: "",
    };

    expect(authorise("conversation.access", conversation).allowed).toBe(true);
    expect(
      authorise("conversation.access", { ...conversation, teammateActorId: "8" }).allowed,
    ).toBe(false);
    expect(authorise("conversation.access", { ...conversation, plan: "free" }).allowed).toBe(false);
    expect(authorise("capability.use", { granted: true, excluded: true }).allowed).toBe(false);
  });

  it("requires approval for unknown, destructive and write connector operations", () => {
    const read = { supported: true, access: "read", destructive: false, agentIdentity: false };

    expect(authorise("connector.unattended", read).allowed).toBe(true);
    expect(authorise("connector.unattended", { ...read, supported: false }).allowed).toBe(false);
    expect(authorise("connector.unattended", { ...read, destructive: true }).allowed).toBe(false);
    expect(authorise("connector.unattended", { ...read, access: "write" }).allowed).toBe(false);
  });

  it("lets a manager move a report's budget only within the workspace's remaining cap", () => {
    const raise = { manager: true, raising: true, capped: true, withinHeadroom: true };

    expect(authorise("teammate.budget", raise).allowed).toBe(true);
    expect(authorise("teammate.budget", { ...raise, withinHeadroom: false }).allowed).toBe(false);
    expect(authorise("teammate.budget", { ...raise, capped: false }).allowed).toBe(false);
    expect(authorise("teammate.budget", { ...raise, manager: false }).allowed).toBe(false);
    expect(
      authorise("teammate.budget", {
        ...raise,
        raising: false,
        capped: false,
        withinHeadroom: false,
      }).allowed,
    ).toBe(true);
  });

  it("lets agent identities act without a person but never on unknown operations", () => {
    const send = { supported: true, access: "write", destructive: true, agentIdentity: true };

    expect(authorise("connector.unattended", send).allowed).toBe(true);
    expect(authorise("connector.unattended", { ...send, supported: false }).allowed).toBe(false);
  });

  it("binds approval replay to the owner, scope, operation and live grant revision", () => {
    const replay = {
      sessionId: "session",
      requestSessionId: "session",
      kind: "tool",
      actorId: "7",
      ownerId: "7",
      sessionScope: "project-a",
      approvalScope: "project-a",
      operations: ["read"],
      operation: "read",
      hasAuthConfig: true,
      hasConnectedAccount: true,
      state: "active",
      expiresAt: 200,
      now: 100,
    };

    expect(authorise("connector.replay", replay).allowed).toBe(true);
    expect(authorise("connector.replay", { ...replay, ownerId: "8" }).allowed).toBe(false);
    expect(authorise("connector.replay", { ...replay, approvalScope: "project-b" }).allowed).toBe(
      false,
    );
    expect(authorise("connector.replay", { ...replay, operation: "write" }).allowed).toBe(false);
    expect(authorise("connector.replay", { ...replay, expiresAt: 100 }).allowed).toBe(false);
    expect(authorise("connector.replay", { ...replay, state: "revoked" }).allowed).toBe(false);
    const grant = {
      connectionId: "connection",
      approvedConnectionId: "connection",
      revision: 2,
      approvedRevision: 2,
      operations: ["read"],
      operation: "read",
    };

    expect(authorise("grant.revision", grant).allowed).toBe(true);
    expect(authorise("grant.revision", { ...grant, revision: 3 }).allowed).toBe(false);
    expect(authorise("grant.revision", { ...grant, connectionId: "other" }).allowed).toBe(false);
  });

  it("requires a different approver and prevents writes outside granted Git refs", () => {
    const approval = { separationOfDuties: true, actorId: "7", requestedBy: "7" };

    expect(authorise("model.approve", approval).allowed).toBe(false);
    expect(authorise("model.approve", { ...approval, actorId: "8" }).allowed).toBe(true);
    const git = {
      refs: ["refs/heads/task"],
      allowedRefs: ["refs/heads/task"],
      targetRef: "refs/heads/main",
      approvedTargetRef: "refs/heads/main",
    };

    expect(authorise("git.write", git).allowed).toBe(true);
    expect(authorise("git.write", { ...git, refs: [] }).allowed).toBe(false);
    expect(authorise("git.write", { ...git, refs: ["refs/heads/main"] }).allowed).toBe(false);
    expect(authorise("git.write", { ...git, targetRef: "refs/heads/release" }).allowed).toBe(false);
  });

  it("denies unknown actions, malformed facts, and policy errors even with a matching permit", () => {
    const schema = actionSchema({ read: { owner: stringAttribute } });

    expect(() =>
      createAuthorizer({
        id: "invalid",
        schema,
        policies: {
          staticPolicies: "permit(principal, action, resource) when { context.missing };",
        },
      }),
    ).toThrow("Invalid Cedar policy");
    const decide = createAuthorizer({
      id: "valid",
      schema,
      policies: {
        staticPolicies:
          'permit(principal, action == Polychat::Action::"read", resource) when { context.owner == "7" };',
      },
    });
    const request = {
      principal: { type: "Polychat::Actor", id: "7" },
      action: { type: "Polychat::Action", id: "read" },
      resource: { type: "Polychat::Resource", id: "document" },
      context: { owner: "7" },
    };

    expect(decide(request).allowed).toBe(true);
    expect(decide({ ...request, context: {} }).allowed).toBe(false);
    expect(decide({ ...request, context: { owner: 7 } }).allowed).toBe(false);
    expect(decide({ ...request, action: { type: "Polychat::Action", id: "delete" } }).allowed).toBe(
      false,
    );
  });

  it("keeps per-context decisions distinct within an authorisation pass", () => {
    const canExecute = createAuthorisationPass("model.execute");
    const model = {
      plan: "",
      active: true,
      free: true,
      byok: false,
      onDevice: false,
      platformEnabled: true,
    };
    const contexts = [
      model,
      { ...model, free: false },
      { ...model, active: false },
      { ...model, free: false, plan: "pro" },
      model,
    ];

    expect(contexts.map((context) => canExecute(context))).toEqual(
      contexts.map((context) => authorise("model.execute", context).allowed),
    );
    expect(new Set(contexts.map((context) => canExecute(context))).size).toBe(2);
  });

  it("lets free accounts benchmark only on their own keys", () => {
    const run = { signedIn: true, plan: "free", byok: false };

    expect(authorise("benchmark.run.start", run).allowed).toBe(false);
    expect(authorise("benchmark.run.start", { ...run, byok: true }).allowed).toBe(true);
    expect(authorise("benchmark.run.start", { ...run, plan: "pro" }).allowed).toBe(true);
    expect(
      authorise("benchmark.run.start", { signedIn: false, plan: "pro", byok: true }).allowed,
    ).toBe(false);
  });

  it("decides each action with its own policies exactly as the full policy set does", () => {
    const partitioned = createAuthorizer(authorisationBundle(), { preparse: true });
    const full = createAuthorizer(authorisationBundle());
    const requests = [
      [
        "resource.write",
        { actorId: "7", ownerId: "8", scope: "project", member: true, role: "admin" },
      ],
      [
        "resource.read",
        { actorId: "7", ownerId: "8", scope: "project", member: false, role: "member" },
      ],
      ["entitlement.pro", { plan: "pro" }],
      ["entitlement.pro", { plan: "free" }],
      [
        "connector.unattended",
        { supported: true, access: "read", destructive: false, agentIdentity: false },
      ],
      [
        "connector.unattended",
        { supported: true, access: "write", destructive: false, agentIdentity: false },
      ],
      [
        "model.execute",
        { plan: "", active: true, free: true, byok: false, onDevice: false, platformEnabled: true },
      ],
      [
        "model.execute",
        {
          plan: "",
          active: true,
          free: false,
          byok: false,
          onDevice: false,
          platformEnabled: true,
        },
      ],
    ] as const;

    for (const [action, context] of requests) {
      const request = {
        principal: { type: "Polychat::Actor", id: "request" },
        action: { type: "Polychat::Action", id: action },
        resource: { type: "Polychat::Resource", id: "request" },
        context: { ...context },
      };

      expect(partitioned(request)).toEqual(full(request));
    }
  });

  it("never lets a floor effect earn a standing approval", () => {
    const write = {
      hasTeammateContext: true,
      autonomyLevel: "assistant",
      effectClass: "write",
      hasDestination: true,
    };

    expect(authorise("approval.standing", write).allowed).toBe(true);
    expect(authorise("approval.standing", { ...write, hasDestination: false }).allowed).toBe(false);
    expect(authorise("approval.standing", { ...write, hasTeammateContext: false }).allowed).toBe(
      false,
    );
    expect(authorise("approval.standing", { ...write, autonomyLevel: "partner" }).allowed).toBe(
      false,
    );

    for (const effectClass of [
      "external_send",
      "spend",
      "destructive",
      "credential",
      "data_export",
    ]) {
      expect(authorise("approval.standing", { ...write, effectClass }).allowed).toBe(false);
    }
  });

  it("binds a message approval to its owner, sender, pending call, arguments and expiry", () => {
    const reply = {
      actorId: "7",
      ownerId: "7",
      channel: "telegram",
      approvalChannel: "telegram",
      senderKey: "binding_1:sender_1:2",
      approvalSenderKey: "binding_1:sender_1:2",
      interactionId: "call_1",
      pendingInteractionId: "call_1",
      argumentDigest: "digest",
      approvalArgumentDigest: "digest",
      runAttempt: 1,
      approvalRunAttempt: 1,
      runStatus: "awaiting_approval",
      state: "pending",
      expiresAt: 2_000,
      now: 1_000,
      effectClass: "external_send",
      resolution: "approved",
    };

    expect(authorise("approval.message", reply).allowed).toBe(true);

    for (const changed of [
      { ownerId: "8" },
      { approvalChannel: "slack" },
      { approvalSenderKey: "binding_1:sender_1:3" },
      { senderKey: "", approvalSenderKey: "" },
      { pendingInteractionId: "call_2" },
      { approvalArgumentDigest: "other" },
      { approvalRunAttempt: 2 },
      { runStatus: "running" },
      { state: "approved" },
      { expiresAt: 1_000 },
      { effectClass: "credential" },
    ]) {
      expect(authorise("approval.message", { ...reply, ...changed }).allowed).toBe(false);
    }

    expect(
      authorise("approval.message", { ...reply, effectClass: "credential", resolution: "rejected" })
        .allowed,
    ).toBe(true);
  });
});
