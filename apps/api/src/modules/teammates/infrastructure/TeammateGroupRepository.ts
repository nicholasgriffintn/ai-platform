import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface TeammateGroupRecord {
  conversationId: string;
  name: string;
  teammateIds: string[];
  projectId: string | null;
  createdAt: string;
  lastActivityAt: string;
  unread: boolean;
}

interface TeammateGroupMemberJoin {
  conversation_id: string;
  teammate_id: string;
  title: string | null;
  project_id: string | null;
  created_at: string;
  last_activity_at: string;
  is_unread: number;
}

function groupRows(rows: readonly TeammateGroupMemberJoin[]): TeammateGroupRecord[] {
  const groups = new Map<string, TeammateGroupRecord>();

  for (const row of rows) {
    const group = groups.get(row.conversation_id) ?? {
      conversationId: row.conversation_id,
      name: row.title ?? "Group",
      teammateIds: [],
      projectId: row.project_id,
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at,
      unread: row.is_unread === 1,
    };

    groups.set(row.conversation_id, {
      ...group,
      teammateIds: [...group.teammateIds, row.teammate_id],
    });
  }

  return [...groups.values()];
}

const MEMBER_SELECT = `SELECT m.conversation_id, m.teammate_id, c.title, c.project_id, m.created_at,
    COALESCE(c.last_message_at, c.updated_at, c.created_at) AS last_activity_at,
    COALESCE(state.is_unread, 0) AS is_unread
  FROM teammate_group_member m
  JOIN conversation c ON c.id = m.conversation_id
  LEFT JOIN user_resource_state state
    ON state.conversation_id = c.id AND state.user_id = c.user_id`;

export class TeammateGroupRepository extends BaseRepository {
  async addMembers(params: {
    conversationId: string;
    teammateIds: readonly string[];
    addedBy: number;
  }): Promise<void> {
    await this.env.DB.batch(
      params.teammateIds.map((teammateId, position) =>
        this.env.DB.prepare(
          `INSERT INTO teammate_group_member (conversation_id, teammate_id, position, added_by)
           VALUES (?, ?, ?, ?)`,
        ).bind(params.conversationId, teammateId, position, params.addedBy),
      ),
    );
  }

  async listForUser(userId: number): Promise<TeammateGroupRecord[]> {
    const rows = await this.runQuery<TeammateGroupMemberJoin>(
      `${MEMBER_SELECT}
       WHERE c.user_id = ? AND COALESCE(c.is_archived, 0) = 0
       ORDER BY c.updated_at DESC, m.position ASC`,
      [userId],
    );

    return groupRows(rows);
  }

  async getByConversationId(conversationId: string): Promise<TeammateGroupRecord | null> {
    const rows = await this.runQuery<TeammateGroupMemberJoin>(
      `${MEMBER_SELECT}
       WHERE m.conversation_id = ?
       ORDER BY m.position ASC`,
      [conversationId],
    );

    return groupRows(rows)[0] ?? null;
  }
}
