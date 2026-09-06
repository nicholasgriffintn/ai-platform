import { Wand2 } from "lucide-react";
import type { ComponentProps, FC } from "react";
import { Suspense, forwardRef, lazy, useMemo } from "react";

import type { IconType } from "./icon-type";
import { ICON_LOADERS } from "./iconLoaders";
import { getProviderColor } from "./providerColor";
import { resolveModelIconName, resolveProviderIconName } from "./resolveIconName";

const MissingIcon: IconType = forwardRef(() => null);

export interface ModelIconProps extends ComponentProps<"div"> {
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
      const modelIcon = resolveModelIconName(modelName);

      if (modelIcon) {
        return { iconName: modelIcon, iconType: "model" };
      }

      const providerIcon = provider ? resolveProviderIconName(provider) : undefined;

      if (providerIcon) {
        return { iconName: providerIcon, iconType: "provider" };
      }

      return { iconName: "", iconType: "fallback" };
    }, [modelName, provider]);

    const IconComponent = useMemo(() => {
      const loadIcon = iconName ? ICON_LOADERS[iconName] : undefined;

      if (!loadIcon) {
        return null;
      }

      return lazy(() => loadIcon().catch(() => ({ default: MissingIcon })));
    }, [iconName]);

    if (!IconComponent && iconType === "fallback" && !showFallback) {
      return null;
    }

    const containerSize = typeof size === "number" ? size : Number.parseInt(size, 10) || 20;
    const iconLabel = provider ? `${modelName} by ${provider}` : modelName;

    if (url) {
      return (
        <img
          src={url}
          alt={modelName}
          className="h-6 w-6 rounded-full object-cover"
          decoding="async"
          loading="lazy"
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
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Wand2 size={containerSize * 0.8} aria-hidden="true" />
          </div>
        ) : (
          <>
            {iconType === "fallback" && showFallback && (
              <TextFallback text={modelName} provider={provider} size={containerSize} />
            )}

            {iconType !== "fallback" && IconComponent && (
              <Suspense
                fallback={
                  showFallback ? (
                    <TextFallback text={modelName} provider={provider} size={containerSize} />
                  ) : null
                }
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={mono ? "text-foreground" : ""}>
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
