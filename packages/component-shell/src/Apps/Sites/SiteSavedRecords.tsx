import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { useSiteData, useSiteStorage } from "@ngriffin_uk/polychat-library-react";
import type { SiteRecord } from "@ngriffin_uk/polychat-schemas";

export function SiteSavedRecords({
  site,
  data,
  storage,
  disabled,
}: {
  site: SiteRecord;
  data: ReturnType<typeof useSiteData>;
  storage: ReturnType<typeof useSiteStorage>;
  disabled: boolean;
}) {
  if (!Object.keys(site.project.collections ?? {}).length) {
    return null;
  }

  const status = data.data?.runtime;
  const active = status?.enabled && status.revision === site.revision;

  return (
    <details className="rounded-md border border-border p-3 text-xs">
      <summary className="cursor-pointer font-medium">Saved records</summary>
      <div className="mt-3 flex flex-col gap-2">
        <p>Save records between visits. Disabling storage preserves existing records.</p>
        <Button
          size="xs"
          variant="outline"
          disabled={disabled || data.isPending || Boolean(data.error)}
          isLoading={storage.isPending}
          onClick={() => storage.mutate(!active)}
        >
          {active
            ? "Disable saved records"
            : status?.enabled
              ? "Update saved records"
              : "Enable saved records"}
        </Button>
        {(data.error || storage.error) && (
          <output role="alert" className="text-failure">
            {data.error?.message ?? storage.error?.message}
          </output>
        )}
      </div>
    </details>
  );
}
