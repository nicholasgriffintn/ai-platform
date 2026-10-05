import { describe, expect, it } from "vitest";

import { requireMcpServer } from "~/modules/mcp/application/access";
import { openMcpCredential } from "~/modules/mcp/application/credentials";
import {
  connectMcpServer,
  createMcpServer,
  disconnectMcpServer,
  listMcpServers,
  updateMcpServer,
} from "~/modules/mcp/application/registry";

import { createMcpRegistryFixture } from "../../../../../test/fixtures/mcp-registry";

describe("private MCP catalogue authority", () => {
  it("keeps credentials personal, invalidates stale authority and denies removed workspace members", async () => {
    const fixture = await createMcpRegistryFixture();
    const { owner, member, outsider, workspaceId, projectId, database } = fixture;

    try {
      const server = await createMcpServer(owner, {
        label: "Issue tracker",
        endpoint: "https://tools.example.test/mcp",
        workspaceId,
      });

      await expect(
        createMcpServer(member, {
          label: "Unapproved",
          endpoint: "https://other.example.test/mcp",
          workspaceId,
        }),
      ).rejects.toThrow();
      await expect(requireMcpServer(outsider, server.id)).rejects.toThrow("not found");
      await connectMcpServer(member, server.id, {
        endpointConsent: true,
        credential: { type: "bearer", value: "synthetic-member-token" },
        sharedProjectIds: [projectId],
      });

      const memberConnection = await member.repositories.mcpRegistry.getConnection(server.id, 43);
      const storedServer = await requireMcpServer(owner, server.id);

      if (!memberConnection) {
        throw new Error("MCP member connection is missing");
      }

      expect(memberConnection.encrypted_credential).not.toContain("synthetic-member-token");
      expect((await listMcpServers(owner, workspaceId)).servers[0].connected).toBe(false);
      await expect(openMcpCredential(owner, storedServer, memberConnection)).rejects.toThrow(
        "not available",
      );
      await expect(
        openMcpCredential(
          member,
          { ...storedServer, endpoint: "https://changed.example.test/mcp" },
          memberConnection,
        ),
      ).rejects.toThrow("decrypted");
      await expect(openMcpCredential(member, storedServer, memberConnection)).resolves.toEqual({
        type: "bearer",
        value: "synthetic-member-token",
      });

      await updateMcpServer(owner, server.id, {
        revision: server.revision,
        enabled: true,
        tools: [],
      });

      const revisedConnection = await member.repositories.mcpRegistry.getConnection(server.id, 43);
      const revisedServer = await requireMcpServer(owner, server.id);

      expect(revisedConnection?.revision).toBeGreaterThan(memberConnection.revision);
      await expect(
        updateMcpServer(owner, server.id, { revision: server.revision, enabled: false, tools: [] }),
      ).rejects.toThrow("changed");
      await expect(
        member.repositories.mcpRegistry.saveConnection({
          serverId: server.id,
          userId: 43,
          serverRevision: revisedServer.revision,
          id: memberConnection.id,
          previousRevision: memberConnection.revision,
          encryptedCredential: memberConnection.encrypted_credential,
          sharedProjects: JSON.stringify([projectId]),
        }),
      ).rejects.toThrow("changed");
      await database
        .prepare("DELETE FROM workspace_member WHERE workspace_id = ? AND user_id = 43")
        .bind(workspaceId)
        .run();

      await expect(requireMcpServer(member, server.id)).rejects.toThrow("not found");
      await expect(
        member.repositories.mcpRegistry.saveConnection({
          serverId: server.id,
          userId: 43,
          serverRevision: revisedServer.revision,
          id: memberConnection.id,
          previousRevision: revisedConnection?.revision,
          encryptedCredential: memberConnection.encrypted_credential,
          sharedProjects: JSON.stringify([projectId]),
        }),
      ).rejects.toThrow("changed");
      await disconnectMcpServer(member, server.id);

      expect(await member.repositories.mcpRegistry.getConnection(server.id, 43)).toBeNull();
    } finally {
      await fixture.runtime.dispose();
    }
  }, 30_000);
});
