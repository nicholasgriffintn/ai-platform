import { hashSecret } from "@ngriffin_uk/auth-core";
import type { OidcConnection } from "@ngriffin_uk/polychat-schemas";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  createWorkspaceOidcConnection,
  updateWorkspaceOidcConnection,
  deleteWorkspaceOidcConnection,
  openOidcSecret,
} from "~/modules/auth/application/enterprise/configuration";
import { workspaceAudience } from "~/modules/sync/application/audience";
import { requireWorkspaceAccess } from "~/modules/workspaces/application/access";

import {
  createEnterpriseIdentityContext,
  createEnterpriseIdentityDatabase,
  createOidcTestProvider,
  oidcTestClientId,
  oidcTestIssuer,
} from "./enterprise-identity";

let databaseFixture: Awaited<ReturnType<typeof createEnterpriseIdentityDatabase>>;
let provider: Awaited<ReturnType<typeof createOidcTestProvider>>;
let context: ServiceContext;
let connection: OidcConnection;
let workspaceId: string;

beforeAll(async () => {
  databaseFixture = await createEnterpriseIdentityDatabase();
}, 30_000);
afterAll(async () => {
  vi.unstubAllGlobals();
  await databaseFixture.runtime.dispose();
});
beforeEach(async () => {
  provider = await createOidcTestProvider();
  vi.stubGlobal("fetch", provider.fetcher);
  ({ context, workspaceId } = await createEnterpriseIdentityContext(databaseFixture.database));
  ({ connection } = await createWorkspaceOidcConnection(context, workspaceId, {
    label: "Company sign-in",
    issuer: oidcTestIssuer,
    clientId: oidcTestClientId,
    clientSecret: "test-client-secret",
    signingAlgorithm: "ES256",
    roleMappings: [
      { group: "employees", role: "member" },
      { group: "admins", role: "admin" },
    ],
  }));
});

it("provisions by stable subject, refreshes mapped roles and revokes workspace access when groups disappear", async () => {
  await provider.complete(context, connection, await provider.start(context, connection));
  const first = await context.repositories.users.getUserByOauthAccount(
    `enterprise-${connection.id}`,
    provider.controls.claims.sub,
  );

  expect(first).not.toBeNull();
  if (!first) {
    throw new Error("Enterprise user was not provisioned");
  }

  expect(first.plan_id).toBe("free");
  expect(await context.repositories.workspaces.getMembership(workspaceId, first.id)).toEqual({
    role: "member",
  });
  provider.controls.claims = {
    ...provider.controls.claims,
    email: "changed@example.test",
    groups: ["employees", "admins"],
  };
  await provider.complete(context, connection, await provider.start(context, connection));
  expect(
    (
      await context.repositories.users.getUserByOauthAccount(
        `enterprise-${connection.id}`,
        provider.controls.claims.sub,
      )
    )?.id,
  ).toBe(first.id);
  expect(await context.repositories.workspaces.getMembership(workspaceId, first.id)).toEqual({
    role: "admin",
  });
  expect(await workspaceAudience(context.env, workspaceId)).toContain(first.id);
  expect(
    (await context.repositories.workspaces.listWorkspaces(first.id)).map(
      (workspace) => workspace.id,
    ),
  ).toContain(workspaceId);

  provider.controls.claims = { ...provider.controls.claims, groups: [] };
  await expect(
    provider.complete(context, connection, await provider.start(context, connection)),
  ).rejects.toThrow("groups");
  expect(await context.repositories.workspaces.getMembership(workspaceId, first.id)).toBeNull();
  expect(await context.repositories.workspaces.listWorkspaces(first.id)).toEqual([]);
  expect(await workspaceAudience(context.env, workspaceId)).not.toContain(first.id);
  expect(
    (await context.repositories.enterpriseIdentities.listLinkedForUser(first.id))[0]
      ?.identity_lease_expires_at,
  ).toBeNull();
});

it("rejects login substitution, state replay and invalid identity claims before creating any account or membership", async () => {
  const original = await provider.start(context, connection);
  const substitute = await provider.start(context, connection);

  await expect(
    provider.complete(context, connection, { ...original, cookie: substitute.cookie }),
  ).rejects.toThrow("browser");
  await expect(provider.complete(context, connection, original)).rejects.toThrow();

  for (const claims of [
    { nonce: "unbound-nonce" },
    { aud: "another-client" },
    { iss: "https://other.example.com/" },
    { email_verified: false },
  ]) {
    const flow = await provider.start(context, connection);
    const previous = provider.controls.claims;

    provider.controls.claims = { ...previous, ...claims };
    await expect(provider.complete(context, connection, flow)).rejects.toThrow();
    provider.controls.claims = previous;
  }

  expect(
    await context.repositories.users.getUserByOauthAccount(
      `enterprise-${connection.id}`,
      provider.controls.claims.sub,
    ),
  ).toBeNull();
  expect(await context.repositories.workspaces.listMembers(workspaceId)).toHaveLength(1);
});

it("requires explicit session-bound linking for an existing email and preserves manual ownership", async () => {
  provider.controls.claims = { ...provider.controls.claims, email: "owner@example.test" };
  await expect(
    provider.complete(context, connection, await provider.start(context, connection)),
  ).rejects.toThrow("explicitly link");
  expect(
    await context.repositories.users.getUserByOauthAccount(
      `enterprise-${connection.id}`,
      provider.controls.claims.sub,
    ),
  ).toBeNull();
  const token = "signed-in-owner-session";

  await context.repositories.sessions.create({
    tokenHash: await hashSecret(token),
    userId: "42",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 600_000),
  });
  const pending = await provider.start(context, connection, {
    cookie: "session=" + token,
    link: true,
  });

  await expect(
    provider.complete(context, connection, {
      ...pending,
      cookie: pending.cookie.replace(token, "another-session"),
    }),
  ).rejects.toThrow("Sign in");
  const valid = await provider.start(context, connection, {
    cookie: "session=" + token,
    link: true,
  });

  await provider.complete(context, connection, valid);
  await expect(
    provider.start(context, connection, { cookie: "other-session=" + token, link: true }),
  ).rejects.toThrow("Sign in");
  await expect(
    provider.start(context, connection, {
      cookie: "session=" + token + "; session=" + token,
      link: true,
    }),
  ).rejects.toThrow("Sign in");
  expect(
    (
      await context.repositories.users.getUserByOauthAccount(
        `enterprise-${connection.id}`,
        provider.controls.claims.sub,
      )
    )?.id,
  ).toBe(42);
  expect(await context.repositories.workspaces.getMembership(workspaceId, 42)).toEqual({
    role: "owner",
  });
  provider.controls.claims = { ...provider.controls.claims, groups: [] };
  await expect(
    provider.complete(context, connection, await provider.start(context, connection)),
  ).rejects.toThrow("groups");
  expect(await requireWorkspaceAccess(context, workspaceId, ["owner"])).toMatchObject({
    role: "owner",
  });
});

it("fences expired and reconfigured grants, rotates encrypted secrets and rejects stale configuration", async () => {
  provider.controls.claims = { ...provider.controls.claims, groups: ["admins"] };
  await provider.complete(context, connection, await provider.start(context, connection));
  const user = await context.repositories.users.getUserByOauthAccount(
    `enterprise-${connection.id}`,
    provider.controls.claims.sub,
  );

  if (!user) {
    throw new Error("Enterprise user was not provisioned");
  }

  const target = await databaseFixture.database
    .prepare("INSERT INTO user (email, plan_id) VALUES (?, 'pro') RETURNING id")
    .bind(`removal-${workspaceId}@example.test`)
    .first<{ id: number }>();

  if (!target) {
    throw new Error("Removal target was not created");
  }

  await databaseFixture.database.batch([
    databaseFixture.database.prepare("UPDATE user SET plan_id = 'pro' WHERE id = ?").bind(user.id),
    databaseFixture.database
      .prepare("INSERT INTO workspace_member (workspace_id, user_id, role) VALUES (?, ?, 'member')")
      .bind(workspaceId, target.id),
  ]);
  await expect(
    context.repositories.workspaces.removeMember(workspaceId, 42, user.id),
  ).rejects.toThrow("membership changed");

  await databaseFixture.database
    .prepare(
      "UPDATE workspace_member SET identity_lease_expires_at = ? WHERE workspace_id = ? AND user_id = ?",
    )
    .bind("2000-01-01T00:00:00.000Z", workspaceId, user.id)
    .run();
  expect(await context.repositories.workspaces.getMembership(workspaceId, user.id)).toBeNull();
  await expect(
    context.repositories.workspaces.removeMember(workspaceId, target.id, user.id),
  ).rejects.toThrow("membership changed");
  expect(await context.repositories.workspaces.getMembership(workspaceId, target.id)).toEqual({
    role: "member",
  });
  await provider.complete(context, connection, await provider.start(context, connection));
  await context.repositories.workspaces.removeMember(workspaceId, target.id, user.id);
  expect(await context.repositories.workspaces.getMembership(workspaceId, target.id)).toBeNull();
  const pending = await provider.start(context, connection);
  const update = {
    label: connection.label,
    allowedOrigins: connection.allowedOrigins,
    signingAlgorithm: connection.signingAlgorithm,
    groupsClaim: connection.groupsClaim,
    roleMappings: connection.roleMappings,
    enabled: true,
    expectedRevision: connection.revision,
  };
  const updated = await updateWorkspaceOidcConnection(context, workspaceId, {
    ...update,
    clientSecret: "rotated-secret",
  });

  expect(await context.repositories.workspaces.getMembership(workspaceId, user.id)).toBeNull();
  await expect(provider.complete(context, connection, pending)).rejects.toThrow();
  await expect(updateWorkspaceOidcConnection(context, workspaceId, update)).rejects.toThrow(
    "reload",
  );
  const stored = await context.repositories.enterpriseIdentities.getById(connection.id);

  if (!stored || !updated.connection) {
    throw new Error("Identity configuration disappeared");
  }

  expect(stored.encrypted_secret).not.toContain("rotated-secret");
  expect(await openOidcSecret(context, stored)).toBe("rotated-secret");
  expect(
    await context.repositories.enterpriseIdentities.grantMembership({
      connection,
      userId: user.id,
      role: "admin",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }),
  ).toBe(false);
  await deleteWorkspaceOidcConnection(context, workspaceId);
  expect(
    await databaseFixture.database
      .prepare("SELECT * FROM workspace_member WHERE workspace_id = ? AND user_id = ?")
      .bind(workspaceId, user.id)
      .first(),
  ).toBeNull();
  expect(await context.repositories.workspaces.getMembership(workspaceId, 42)).toEqual({
    role: "owner",
  });
});
