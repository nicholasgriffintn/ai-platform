export interface BusEvent<TPayload> {
  seq: number;
  at: string;
  payload: TPayload;
}

export interface BusAppendResult<TPayload> {
  event: BusEvent<TPayload>;
  oldestRetainedSeq: number;
}

export interface BusReadResult<TPayload> {
  events: BusEvent<TPayload>[];
  latestSeq: number;
  oldestRetainedSeq: number;
  resetRequired: boolean;
}

export interface TopicEventBusOptions {
  retentionLimit: number;
}

function tableName(scope: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(scope)) {
    throw new Error(`Unsafe event bus scope: ${scope}`);
  }

  return `bus_${scope}`;
}

export class TopicEventBus<TPayload> {
  private readonly table: string;
  private readonly retentionLimit: number;
  private initialised = false;

  constructor(
    private readonly storage: DurableObjectStorage,
    scope: string,
    options: TopicEventBusOptions,
  ) {
    this.table = tableName(scope);
    this.retentionLimit = options.retentionLimit;
  }

  private get sql(): SqlStorage {
    const sql = this.storage.sql;

    if (!sql) {
      throw new Error("Durable Object storage does not expose SQL");
    }

    return sql;
  }

  private ensureSchema(): void {
    if (this.initialised) {
      return;
    }

    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS ${this.table} (
         topic TEXT NOT NULL,
         seq INTEGER NOT NULL,
         at TEXT NOT NULL,
         payload TEXT NOT NULL,
         PRIMARY KEY (topic, seq)
       )`,
    );
    this.initialised = true;
  }

  public latestSeq(topic: string): number {
    this.ensureSchema();

    const row = this.sql
      .exec<{ seq: number | null }>(
        `SELECT MAX(seq) AS seq FROM ${this.table} WHERE topic = ?`,
        topic,
      )
      .one();

    return row.seq ?? 0;
  }

  private oldestSeq(topic: string): number {
    const row = this.sql
      .exec<{ seq: number | null }>(
        `SELECT MIN(seq) AS seq FROM ${this.table} WHERE topic = ?`,
        topic,
      )
      .one();

    return row.seq ?? 0;
  }

  public append(topic: string, payload: TPayload): BusAppendResult<TPayload> {
    this.ensureSchema();

    const seq = this.latestSeq(topic) + 1;
    const at = new Date().toISOString();

    this.sql.exec(
      `INSERT INTO ${this.table} (topic, seq, at, payload) VALUES (?, ?, ?, ?)`,
      topic,
      seq,
      at,
      JSON.stringify(payload),
    );
    this.sql.exec(
      `DELETE FROM ${this.table} WHERE topic = ? AND seq <= ?`,
      topic,
      seq - this.retentionLimit,
    );

    return { event: { seq, at, payload }, oldestRetainedSeq: this.oldestSeq(topic) };
  }

  public read(topic: string, after: number, limit = this.retentionLimit): BusReadResult<TPayload> {
    this.ensureSchema();

    const latestSeq = this.latestSeq(topic);
    const oldestRetainedSeq = this.oldestSeq(topic);

    if (after > latestSeq) {
      return { events: [], latestSeq, oldestRetainedSeq, resetRequired: true };
    }

    if (after < oldestRetainedSeq - 1 || (after === 0 && latestSeq > 0 && oldestRetainedSeq > 1)) {
      return { events: [], latestSeq, oldestRetainedSeq, resetRequired: true };
    }

    const rows = this.sql
      .exec<{ seq: number; at: string; payload: string }>(
        `SELECT seq, at, payload FROM ${this.table}
         WHERE topic = ? AND seq > ?
         ORDER BY seq ASC
         LIMIT ?`,
        topic,
        after,
        limit,
      )
      .toArray();

    return {
      events: rows.map((row) => ({
        seq: row.seq,
        at: row.at,
        payload: JSON.parse(row.payload) as TPayload,
      })),
      latestSeq,
      oldestRetainedSeq,
      resetRequired: false,
    };
  }

  public clear(topic: string): void {
    this.ensureSchema();
    this.sql.exec(`DELETE FROM ${this.table} WHERE topic = ?`, topic);
  }
}
