import type { RecipeConnectorManifest } from "@assistant/schemas";
import { useState } from "react";

import { ModelIcon } from "~/components/ModelIcon";
import { cn } from "~/lib/utils";

export function ConnectorLogo({
	connector,
	className,
}: {
	connector: RecipeConnectorManifest;
	className?: string;
}) {
	const [failed, setFailed] = useState(false);
	return (
		<div
			className={cn(
				"flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900",
				className,
			)}
		>
			{connector.logoUrl && !failed ? (
				<img
					src={connector.logoUrl}
					alt=""
					className="size-8 object-contain"
					onError={() => setFailed(true)}
				/>
			) : (
				<ModelIcon modelName={connector.name} provider={connector.id} size={28} showFallback />
			)}
		</div>
	);
}
