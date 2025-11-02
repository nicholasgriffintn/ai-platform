import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { useAuthStatus } from "~/hooks/useAuth";
import { formatDate } from "~/lib/dates";

const AUTH_DAILY_MESSAGE_LIMIT = 50;
const DAILY_LIMIT_PRO_MODELS = 200;

export function ProfileAccountTab() {
	const { user } = useAuthStatus();

	const formatTimeAgo = (dateString: string | null | undefined) => {
		if (!dateString) return "N/A";

		try {
			const lastResetDate = new Date(dateString);
			const nextResetDate = new Date(lastResetDate);
			nextResetDate.setHours(nextResetDate.getHours() + 24);

			const now = new Date();
			const diffMs = nextResetDate.getTime() - now.getTime();

			if (diffMs < 0) return "any moment now";

			const diffSecs = Math.floor(diffMs / 1000);
			const diffMins = Math.floor(diffSecs / 60);
			const diffHours = Math.floor(diffMins / 60);
			const diffDays = Math.floor(diffHours / 24);

			if (diffDays > 0) {
				return `in ${diffDays} day${diffDays > 1 ? "s" : ""}`;
			}

			if (diffHours > 0) {
				return `in ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
			}

			if (diffMins > 0) {
				return `in ${diffMins} minute${diffMins > 1 ? "s" : ""}`;
			}

			return `in ${diffSecs} second${diffSecs !== 1 ? "s" : ""}`;
		} catch (_e) {
			return "unknown time";
		}
	};

	return (
		<div>
			<PageHeader>
				<PageTitle title="Account" />
			</PageHeader>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
				<div className="flex flex-col items-center md:col-span-1">
					{user?.avatar_url ? (
						<img
							src={user.avatar_url}
							alt={user?.name || "Your Account"}
							className="w-32 h-32 rounded-full object-cover mb-2 border-2 border-indigo-500"
						/>
					) : (
						<div className="w-32 h-32 rounded-full bg-indigo-500 flex items-center justify-center text-white text-5xl font-semibold mb-2">
							{user?.name ? user.name.charAt(0).toUpperCase() : "U"}
						</div>
					)}
					<h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
						{user?.name || "Your Account"}
					</h2>
					{user?.email && (
						<p className="text-zinc-500 dark:text-zinc-400">{user?.email}</p>
					)}
					{user?.github_username && (
						<p className="text-zinc-500 dark:text-zinc-400">
							<a
								href={`https://github.com/${user.github_username}`}
								target="_blank"
								rel="noopener noreferrer"
								className="text-zinc-700 dark:text-zinc-300"
							>
								@{user.github_username}
							</a>
						</p>
					)}
					<div className="mt-2 px-3 py-1 bg-zinc-200 dark:bg-zinc-700 rounded-full text-sm text-zinc-700 dark:text-zinc-300">
						{user?.plan_id === "pro" ? "Pro Plan" : "Free Plan"}
					</div>
				</div>
				<div className="md:col-span-3">
					<div>
						<div>
							<h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-4">
								Account Information
							</h3>
							<div className="space-y-3">
								{user?.created_at && (
									<div className="flex justify-between">
										<span className="text-zinc-500 dark:text-zinc-400">
											Member since
										</span>
										<span className="text-zinc-800 dark:text-zinc-200">
											{formatDate(user?.created_at)}
										</span>
									</div>
								)}
								<div className="flex justify-between">
									<span className="text-zinc-500 dark:text-zinc-400">Plan</span>
									<span className="text-zinc-800 dark:text-zinc-200">
										{user?.plan_id === "pro" ? "Pro" : "Free"}
									</span>
								</div>
								{user?.company && (
									<div className="flex justify-between">
										<span className="text-zinc-500 dark:text-zinc-400">
											Company
										</span>
										<span className="text-zinc-800 dark:text-zinc-200">
											{user.company}
										</span>
									</div>
								)}
								{user?.location && (
									<div className="flex justify-between">
										<span className="text-zinc-500 dark:text-zinc-400">
											Location
										</span>
										<span className="text-zinc-800 dark:text-zinc-200">
											{user.location}
										</span>
									</div>
								)}
							</div>
						</div>
					</div>

					{user?.bio && (
						<div className="pt-4">
							<h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-4">
								Bio
							</h3>
							<p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
								{user.bio}
							</p>
						</div>
					)}

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{user?.site && (
							<div>
								<h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-2">
									Website
								</h3>
								<a
									href={
										user.site.startsWith("http")
											? user.site
											: `https://${user.site}`
									}
									target="_blank"
									rel="noopener noreferrer"
									className="text-zinc-700 dark:text-zinc-300"
								>
									{user.site}
								</a>
							</div>
						)}

						{user?.twitter_username && (
							<div>
								<h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-2">
									Twitter
								</h3>
								<a
									href={`https://twitter.com/${user.twitter_username}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-zinc-700 dark:text-zinc-300"
								>
									@{user.twitter_username}
								</a>
							</div>
						)}
					</div>

					<div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-6" />

					<h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-6">
						Usage
					</h2>

					<div className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
							<div className="bg-white dark:bg-zinc-700 rounded-md p-4 shadow-sm">
								<h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-2">
									Total Messages
								</h3>
								<div className="text-zinc-700 dark:text-zinc-300 text-2xl font-medium">
									{user?.message_count || 0}
								</div>
								<div className="text-zinc-500 dark:text-zinc-400 text-sm">
									Messages sent since joining
								</div>
							</div>

							<div className="bg-white dark:bg-zinc-700 rounded-md p-4 shadow-sm">
								<h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-2">
									Last Activity
								</h3>
								<div className="text-zinc-700 dark:text-zinc-300 text-2xl font-medium">
									{user?.last_active_at
										? formatDate(user.last_active_at)
										: "Never"}
								</div>
								<div className="text-zinc-500 dark:text-zinc-400 text-sm">
									Last time you used the platform
								</div>
							</div>
						</div>

						<div>
							<h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-2">
								Usage & Limits
							</h3>

							<div className="grid gap-4">
								{/* Standard usage card */}
								<div className="bg-white dark:bg-zinc-700 rounded-md p-4 shadow-sm">
									<div className="flex justify-between items-center mb-3">
										<div className="font-medium text-zinc-800 dark:text-zinc-100">
											Standard Usage
										</div>
										<div className="text-zinc-700 dark:text-zinc-300 text-sm">
											{user?.daily_message_count || 0} /{" "}
											{AUTH_DAILY_MESSAGE_LIMIT}
										</div>
									</div>

									<div className="w-full bg-zinc-200 rounded-full h-2.5 dark:bg-zinc-800 mb-3">
										<div
											className="bg-blue-500 h-2.5 rounded-full"
											style={{
												width: `${((user?.daily_message_count || 0) / AUTH_DAILY_MESSAGE_LIMIT) * 100}%`,
											}}
										/>
									</div>

									<div className="flex items-center justify-between text-sm">
										<div className="text-zinc-700 dark:text-zinc-300 flex items-center">
											<div className="h-3 w-3 bg-blue-500 rounded-full mr-2" />
											<span>{AUTH_DAILY_MESSAGE_LIMIT} messages per day</span>
										</div>
										<div className="text-zinc-500 dark:text-zinc-400">
											Resets {formatTimeAgo(user?.daily_reset)}
										</div>
									</div>
								</div>

								{/* Pro usage info */}
								{user?.plan_id === "pro" && (
									<div className="bg-white dark:bg-zinc-700 rounded-md p-4 shadow-sm">
										<div className="flex justify-between items-center mb-3">
											<div className="font-medium text-zinc-800 dark:text-zinc-100">
												Premium Usage
											</div>
											<div className="text-zinc-700 dark:text-zinc-300 text-sm">
												{user?.daily_pro_message_count || 0} /{" "}
												{DAILY_LIMIT_PRO_MODELS}
											</div>
										</div>

										<div className="w-full bg-zinc-200 rounded-full h-2.5 dark:bg-zinc-800 mb-3">
											<div
												className="bg-purple-500 h-2.5 rounded-full"
												style={{
													width: `${((user?.daily_pro_message_count || 0) / DAILY_LIMIT_PRO_MODELS) * 100}%`,
												}}
											/>
										</div>

										<div className="flex items-center justify-between text-sm mb-4">
											<div className="text-zinc-700 dark:text-zinc-300 flex items-center">
												<div className="h-3 w-3 bg-purple-500 rounded-full mr-2" />
												<span>{DAILY_LIMIT_PRO_MODELS} pro tokens per day</span>
											</div>
											<div className="text-zinc-500 dark:text-zinc-400">
												Resets {formatTimeAgo(user?.daily_pro_reset)}
											</div>
										</div>

										<div className="pt-3 border-t border-zinc-200 dark:border-zinc-600">
											<div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
												Approximate message equivalents:
											</div>
											<div className="grid grid-cols-3 gap-2">
												<div className="bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
													<div className="text-xs text-zinc-500 dark:text-zinc-400">
														Expensive models
													</div>
													<div className="font-medium text-zinc-800 dark:text-zinc-100">
														~22 messages
													</div>
												</div>
												<div className="bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
													<div className="text-xs text-zinc-500 dark:text-zinc-400">
														Mid-tier models
													</div>
													<div className="font-medium text-zinc-800 dark:text-zinc-100">
														~66 messages
													</div>
												</div>
												<div className="bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
													<div className="text-xs text-zinc-500 dark:text-zinc-400">
														Cheaper models
													</div>
													<div className="font-medium text-zinc-800 dark:text-zinc-100">
														100-200 messages
													</div>
												</div>
											</div>
										</div>
									</div>
								)}
							</div>

							<div className="mt-4">
								<Alert variant="info">
									<AlertTitle>Function Call Usage</AlertTitle>
									<AlertDescription>
										Please note that when messages trigger a function call they
										are counted as additional usage against your normal or
										premium limits, depending on the function that was called.
									</AlertDescription>
								</Alert>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
