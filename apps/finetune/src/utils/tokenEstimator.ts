export class TokenEstimator {
	static estimate(text: string): number {
		return Math.ceil(text.length / 3.5);
	}

	static estimateRequest(systemPrompt: string, userPrompt: string): number {
		const systemTokens = this.estimate(systemPrompt);
		const userTokens = this.estimate(userPrompt);
		const overhead = 50;

		return systemTokens + userTokens + overhead;
	}
}
