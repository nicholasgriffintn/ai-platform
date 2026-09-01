import { BaseRepository } from "./BaseRepository";

export interface InfraCostDailyUpsert {
  day: string;
  resource: string;
  unit: string;
  quantity: number;
  costMicros: number;
  attributedCostMicros: number;
  source?: string;
}

export interface InfraCostDailyRecord {
  id: string;
  day: string;
  resource: string;
  unit: string;
  quantity: number;
  cost_micros: number;
  attributed_cost_micros: number;
  source: string;
}

export function infraCostDailyId(day: string, resource: string, unit: string): string {
  return `${day}:${resource}:${unit}`;
}

export class InfraCostDailyRepository extends BaseRepository {
  async upsertDay(entry: InfraCostDailyUpsert): Promise<void> {
    await this.executeRun(
      `INSERT INTO infra_cost_daily (
				id, day, resource, unit, quantity, cost_micros, attributed_cost_micros, source
			 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (id) DO UPDATE SET
				quantity = excluded.quantity,
				cost_micros = excluded.cost_micros,
				attributed_cost_micros = excluded.attributed_cost_micros,
				source = excluded.source,
				updated_at = CURRENT_TIMESTAMP`,
      [
        infraCostDailyId(entry.day, entry.resource, entry.unit),
        entry.day,
        entry.resource,
        entry.unit,
        entry.quantity,
        Math.round(entry.costMicros),
        Math.round(entry.attributedCostMicros),
        entry.source ?? "graphql",
      ],
    );
  }

  async listDay(day: string): Promise<InfraCostDailyRecord[]> {
    return this.runQuery<InfraCostDailyRecord>(
      "SELECT * FROM infra_cost_daily WHERE day = ? ORDER BY resource, unit",
      [day],
    );
  }
}
