"use client";

import { Wand2 } from "lucide-react";
import type { ComponentProps, FC } from "react";
import { Suspense, forwardRef, lazy, useMemo, useState } from "react";

import { MODEL_ICONS, PROVIDER_ICONS } from "./iconDefinitions";
import { getProviderColor } from "./utils";

interface ModelIconProps extends ComponentProps<"div"> {
	modelName: string;
	provider?: string;
	mono?: boolean;
	size?: string | number;
	fallbackSize?: number;
	showFallback?: boolean;
	url?: string;
}

const TextFallback: FC<{ text: string; provider?: string; size?: number }> = ({
	text,
	provider,
	size = 20,
}) => {
	const initial = text.charAt(0).toUpperCase();
	const colorClasses = getProviderColor(provider || "");

	return (
		<div
			className={`rounded-full ${colorClasses} flex items-center justify-center font-semibold`}
			style={{ width: size, height: size, fontSize: size * 0.5 }}
			role="img"
			aria-label={`${text} initial`}
		>
			{initial}
		</div>
	);
};

export const ModelIcon = forwardRef<HTMLDivElement, ModelIconProps>(
	(
		{
			modelName,
			provider,
			mono = false,
			size = 20,
			fallbackSize: _fallbackSize = 20,
			showFallback = true,
			url,
			...rest
		},
		ref,
	) => {
		const { iconName, iconType } = useMemo(() => {
			const normalizedModelName = modelName.toLowerCase();

			for (const [pattern, icon] of Object.entries(MODEL_ICONS)) {
				if (normalizedModelName.includes(pattern)) {
					return { iconName: icon, iconType: "model" };
				}
			}

			if (provider) {
				const normalizedProvider = provider.toLowerCase();
				for (const [providerPattern, icon] of Object.entries(PROVIDER_ICONS)) {
					if (normalizedProvider === providerPattern) {
						return { iconName: icon, iconType: "provider" };
					}
				}
			}

			return { iconName: "", iconType: "fallback" };
		}, [modelName, provider]);

		const [isLoaded, setIsLoaded] = useState(false);

		const IconComponent = useMemo(() => {
			if (!iconName) return null;

			return lazy(() =>
				import(`./Icons/${iconName}.tsx`)
					.then((module) => {
						setIsLoaded(true);
						return module;
					})
					.catch(() => {
						setIsLoaded(true);
						return { default: () => null };
					}),
			);
		}, [iconName]);

		if (!IconComponent && iconType === "fallback" && !showFallback) {
			return null;
		}

		const containerSize =
			typeof size === "number"
				? size
				: Number.parseInt(size as string, 10) || 20;
		const iconLabel = provider ? `${modelName} by ${provider}` : modelName;

		if (url) {
			return (
				<img
					src={url}
					alt={modelName}
					className="w-6 h-6 rounded-full object-cover"
				/>
			);
		}

		return (
			<div
				ref={ref}
				className="relative inline-block"
				style={{ width: containerSize, height: containerSize }}
				role="img"
				aria-label={iconLabel}
				{...rest}
			>
				{modelName === "Automatic" ? (
					<div className="absolute inset-0 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
						<Wand2 size={containerSize * 0.8} aria-hidden="true" />
					</div>
				) : (
					<>
						{(iconType === "fallback" || !isLoaded) && showFallback && (
							<TextFallback
								text={modelName}
								provider={provider}
								size={containerSize}
							/>
						)}

						{iconType !== "fallback" && IconComponent && (
							<Suspense
								fallback={
									showFallback ? null : (
										<TextFallback
											text={modelName}
											provider={provider}
											size={containerSize}
										/>
									)
								}
							>
								<div
									className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${isLoaded ? "opacity-100" : "opacity-0"}`}
								>
									<div
										className={`${mono ? "text-black dark:text-white" : ""}`}
									>
										<IconComponent
											size={containerSize}
											style={{
												opacity: mono ? 0.75 : 1,
											}}
											fill={mono ? "currentColor" : undefined}
											fillRule={mono ? "evenodd" : undefined}
											aria-hidden="true"
										/>
									</div>
								</div>
							</Suspense>
						)}
					</>
				)}
			</div>
		);
	},
);

ModelIcon.displayName = "ModelIcon";

export default ModelIcon;
