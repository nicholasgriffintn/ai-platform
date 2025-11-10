import { createLogger } from "./logger.js";

const logger = createLogger("RateLimiter");

export interface RateLimiterOptions {
	maxRequests: number;
	maxTokens?: number;
	windowMs: number;
	delayBetweenRequests?: number;
}

interface RequestRecord {
	timestamp: number;
	tokens: number;
}

export class RateLimiter {
	private readonly maxRequests: number;
	private readonly maxTokens: number | null;
	private readonly windowMs: number;
	private readonly delayBetweenRequests: number;
	private requestRecords: RequestRecord[] = [];

	constructor(options: RateLimiterOptions) {
		this.maxRequests = options.maxRequests;
		this.maxTokens = options.maxTokens || null;
		this.windowMs = options.windowMs;
		this.delayBetweenRequests =
			options.delayBetweenRequests || this.windowMs / this.maxRequests;

		const limits = [`${this.maxRequests} requests`];
		if (this.maxTokens) {
			limits.push(`${this.maxTokens} tokens`);
		}
		logger.info(
			`Rate limiter initialized: ${limits.join(" and ")} per ${this.windowMs / 1000}s (${this.delayBetweenRequests}ms between requests)`,
		);
	}

	async waitForSlot(estimatedTokens: number = 0): Promise<void> {
		const now = Date.now();

		this.requestRecords = this.requestRecords.filter(
			(record) => now - record.timestamp < this.windowMs,
		);

		const currentRequests = this.requestRecords.length;
		const currentTokens = this.requestRecords.reduce(
			(sum, record) => sum + record.tokens,
			0,
		);

		if (currentRequests >= this.maxRequests) {
			const oldestRecord = this.requestRecords[0];
			const waitTime = this.windowMs - (now - oldestRecord.timestamp) + 100; // Add 100ms buffer

			logger.warn(
				`Request rate limit reached (${currentRequests}/${this.maxRequests}). Waiting ${Math.ceil(waitTime / 1000)}s...`,
			);

			await this.sleep(waitTime);
			return this.waitForSlot(estimatedTokens);
		}

		if (
			this.maxTokens &&
			estimatedTokens > 0 &&
			currentTokens + estimatedTokens > this.maxTokens
		) {
			const tokensToFree = currentTokens + estimatedTokens - this.maxTokens;

			let freedTokens = 0;
			let targetTimestamp = now;

			for (const record of this.requestRecords) {
				freedTokens += record.tokens;
				if (freedTokens >= tokensToFree) {
					targetTimestamp = record.timestamp;
					break;
				}
			}

			const waitTime = this.windowMs - (now - targetTimestamp) + 100; // Add 100ms buffer

			logger.warn(
				`Token rate limit reached (${currentTokens + estimatedTokens}/${this.maxTokens}). Waiting ${Math.ceil(waitTime / 1000)}s...`,
			);

			await this.sleep(waitTime);
			return this.waitForSlot(estimatedTokens);
		}

		if (this.requestRecords.length > 0) {
			const lastRequestTime =
				this.requestRecords[this.requestRecords.length - 1].timestamp;
			const timeSinceLastRequest = now - lastRequestTime;

			if (timeSinceLastRequest < this.delayBetweenRequests) {
				const waitTime = this.delayBetweenRequests - timeSinceLastRequest;
				await this.sleep(waitTime);
			}
		}

		this.requestRecords.push({
			timestamp: Date.now(),
			tokens: estimatedTokens,
		});
	}

	getStats(): {
		requestsInWindow: number;
		tokensInWindow: number;
		maxRequests: number;
		maxTokens: number | null;
		windowMs: number;
	} {
		const now = Date.now();
		const recordsInWindow = this.requestRecords.filter(
			(record) => now - record.timestamp < this.windowMs,
		);

		return {
			requestsInWindow: recordsInWindow.length,
			tokensInWindow: recordsInWindow.reduce(
				(sum, record) => sum + record.tokens,
				0,
			),
			maxRequests: this.maxRequests,
			maxTokens: this.maxTokens,
			windowMs: this.windowMs,
		};
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
