export const MessageSkeleton = () => {
	return (
		<div className="animate-pulse">
			<div className="flex justify-start">
				<div className="flex flex-col w-full dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
					<div className="flex flex-col gap-2 px-3 py-2">
						<div className="flex items-start gap-2">
							<div className="flex-1 overflow-x-auto">
								<div className="space-y-3">
									<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
									<div className="space-y-2">
										<div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
										<div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
										<div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
										<div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
									</div>
								</div>
							</div>
						</div>

						<div className="flex justify-end items-center gap-2 mt-2">
							<div className="flex items-center space-x-1">
								<div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-lg" />
								<div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-lg" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
