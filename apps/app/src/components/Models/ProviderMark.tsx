import { ProviderGlyph } from "@ngriffin_uk/polychat-component-models";

export interface ProviderMarkProps {
  provider: string;
  size: number;
}

export function ProviderMark({ provider, size }: ProviderMarkProps) {
  return (
    <ProviderGlyph
      name={provider}
      size={size}
      fallback={
        <span
          aria-hidden
          className="text-muted-foreground font-mono font-semibold uppercase"
          style={{ fontSize: Math.max(10, size * 0.7) }}
        >
          {provider.charAt(0)}
        </span>
      }
    />
  );
}
