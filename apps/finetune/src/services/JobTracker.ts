import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { JobRecord, DatasetRecord } from "../types/index.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("JobTracker");

export class JobTracker {
	private db: Database.Database;

	constructor(dbPath: string = "./datasets/.finetune.db") {
		const dir = dirname(dbPath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}

		this.db = new Database(dbPath);
		this.initialize();
		logger.info(`Initialized job tracker database: ${dbPath}`);
	}

	private initialize() {
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        job_arn TEXT PRIMARY KEY,
        job_name TEXT NOT NULL,
        base_model TEXT NOT NULL,
        custom_model_name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS datasets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        train_path TEXT NOT NULL,
        validation_path TEXT,
        s3_uri TEXT,
        created_at INTEGER NOT NULL,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at);
      CREATE INDEX IF NOT EXISTS idx_datasets_project ON datasets(project);
    `);
	}

	saveJob(
		job: Omit<JobRecord, "createdAt" | "updatedAt"> & {
			createdAt?: number;
			updatedAt?: number;
		},
	): void {
		const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO jobs
      (job_arn, job_name, base_model, custom_model_name, status, created_at, updated_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

		const now = Date.now();
		stmt.run(
			job.jobArn,
			job.jobName,
			job.baseModel,
			job.customModelName,
			job.status,
			job.createdAt || now,
			job.updatedAt || now,
			job.metadata || null,
		);

		logger.info(`Saved job: ${job.jobName}`);
	}

	updateJobStatus(jobArn: string, status: string, metadata?: any): void {
		const stmt = this.db.prepare(`
      UPDATE jobs
      SET status = ?, updated_at = ?, metadata = ?
      WHERE job_arn = ?
    `);

		stmt.run(
			status,
			Date.now(),
			metadata ? JSON.stringify(metadata) : null,
			jobArn,
		);

		logger.info(`Updated job ${jobArn} status: ${status}`);
	}

	getJob(jobArn: string): JobRecord | null {
		const stmt = this.db.prepare(`
      SELECT * FROM jobs WHERE job_arn = ?
    `);

		const row = stmt.get(jobArn) as any;
		return row ? this.mapJobRow(row) : null;
	}

	listJobs(limit: number = 50): JobRecord[] {
		const stmt = this.db.prepare(`
      SELECT * FROM jobs
      ORDER BY created_at DESC
      LIMIT ?
    `);

		const rows = stmt.all(limit) as any[];
		return rows.map((row) => this.mapJobRow(row));
	}

	listJobsByStatus(status: string): JobRecord[] {
		const stmt = this.db.prepare(`
      SELECT * FROM jobs
      WHERE status = ?
      ORDER BY created_at DESC
    `);

		const rows = stmt.all(status) as any[];
		return rows.map((row) => this.mapJobRow(row));
	}

	saveDataset(
		dataset: Omit<DatasetRecord, "id" | "createdAt"> & { createdAt?: number },
	): number {
		const stmt = this.db.prepare(`
      INSERT INTO datasets
      (project, train_path, validation_path, s3_uri, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

		const result = stmt.run(
			dataset.project,
			dataset.trainPath,
			dataset.validationPath || null,
			dataset.s3Uri || null,
			dataset.createdAt || Date.now(),
			dataset.metadata || null,
		);

		const datasetId = Number(result.lastInsertRowid);
		logger.info(`Saved dataset: ${dataset.project} (ID: ${datasetId})`);
		return datasetId;
	}

	listDatasets(project: string): DatasetRecord[] {
		const stmt = this.db.prepare(`
      SELECT * FROM datasets
      WHERE project = ?
      ORDER BY created_at DESC
    `);

		const rows = stmt.all(project) as any[];
		return rows.map((row) => this.mapDatasetRow(row));
	}

	getLatestDataset(project: string): DatasetRecord | null {
		const stmt = this.db.prepare(`
      SELECT * FROM datasets
      WHERE project = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

		const row = stmt.get(project) as any;
		return row ? this.mapDatasetRow(row) : null;
	}

	close(): void {
		this.db.close();
		logger.info("Closed database connection");
	}

	private mapJobRow(row: any): JobRecord {
		return {
			jobArn: row.job_arn,
			jobName: row.job_name,
			baseModel: row.base_model,
			customModelName: row.custom_model_name,
			status: row.status,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			metadata: row.metadata,
		};
	}

	private mapDatasetRow(row: any): DatasetRecord {
		return {
			id: row.id,
			project: row.project,
			trainPath: row.train_path,
			validationPath: row.validation_path,
			s3Uri: row.s3_uri,
			createdAt: row.created_at,
			metadata: row.metadata,
		};
	}
}
