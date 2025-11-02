export interface AIPerformanceMetrics {
	provider: string;
	model: string;
	latency: number;
	tokenUsage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
		prompt_tokens_details?: {
			cached_tokens: number;
			audio_tokens: number;
		};
		completion_tokens_details?: {
			reasoning_tokens: number;
			audio_tokens: number;
			accepted_prediction_tokens: number;
			rejected_prediction_tokens: number;
		};
	};
	systemFingerprint?: string;
	log_id?: string;
}
