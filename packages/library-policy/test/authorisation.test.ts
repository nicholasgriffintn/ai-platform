import { describe, expect, it } from "vitest";

import {
  actionSchema,
  authorise,
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
    const read = { supported: true, access: "read", destructive: false };

    expect(authorise("connector.unattended", read).allowed).toBe(true);
    expect(authorise("connector.unattended", { ...read, supported: false }).allowed).toBe(false);
    expect(authorise("connector.unattended", { ...read, destructive: true }).allowed).toBe(false);
    expect(authorise("connector.unattended", { ...read, access: "write" }).allowed).toBe(false);
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
});
