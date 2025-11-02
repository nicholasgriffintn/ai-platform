export type AnonymousUser = {
	id: string;
	ip_address: string;
	user_agent?: string;
	daily_message_count: number;
	daily_reset?: string;
	created_at: string;
	updated_at: string;
	last_active_at?: string;
	captcha_verified?: number;
};
