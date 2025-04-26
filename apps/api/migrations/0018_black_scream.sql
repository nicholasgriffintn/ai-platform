ALTER TABLE `plans` ADD `stripe_price_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `stripe_subscription_id` text;