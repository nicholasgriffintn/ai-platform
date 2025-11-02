export function NotificationBar({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div
			className="bg-off-white-highlight dark:bg-zinc-800/80 border-l-4 border-blue-500 text-zinc-700 dark:text-zinc-200 p-4"
			role="alert"
			aria-labelledby="notification-bar-title"
			aria-describedby="notification-bar-description"
		>
			<p
				id="notification-bar-title"
				className="font-bold text-zinc-800 dark:text-zinc-100"
			>
				{title}
			</p>
			<p id="notification-bar-description">{description}</p>
		</div>
	);
}
