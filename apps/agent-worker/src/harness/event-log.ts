import {
  agentHarnessEventSchema,
  type AgentHarnessEvent,
  type AgentHarnessEventRecord,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";

const RETAINED_EVENTS = 5_000;
const PRUNE_INTERVAL = 500;

export class HarnessEventLog {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(
      "CREATE TABLE IF NOT EXISTS polychat_harness_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL)",
    );
  }

  append(event: AgentHarnessEvent): AgentHarnessEventRecord {
    const row = this.sql
      .exec<{ seq: number }>(
        "INSERT INTO polychat_harness_events (event) VALUES (?) RETURNING seq",
        JSON.stringify(event),
      )
      .one();

    if (row.seq % PRUNE_INTERVAL === 0) {
      this.sql.exec(
        "DELETE FROM polychat_harness_events WHERE seq <= ?",
        row.seq - RETAINED_EVENTS,
      );
    }

    return { seq: row.seq, event };
  }

  lastSeq(): number {
    return (
      this.sql
        .exec<{ seq: number | null }>("SELECT MAX(seq) AS seq FROM polychat_harness_events")
        .one().seq ?? 0
    );
  }

  after(seq: number): AgentHarnessEventRecord[] {
    return this.sql
      .exec<{ seq: number; event: string }>(
        "SELECT seq, event FROM polychat_harness_events WHERE seq > ? ORDER BY seq",
        seq,
      )
      .toArray()
      .flatMap((row) => {
        const event = agentHarnessEventSchema.safeParse(safeParseJson(row.event));

        return event.success ? [{ seq: row.seq, event: event.data }] : [];
      });
  }
}
