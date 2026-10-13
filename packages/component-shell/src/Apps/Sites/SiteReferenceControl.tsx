import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@ngriffin_uk/polychat-component-ui";
import { siteReferenceUrlSchema } from "@ngriffin_uk/polychat-schemas";
import { Palette } from "lucide-react";
import { useState, type FormEvent } from "react";

export function SiteReferenceControl({
  value,
  isDisabled,
  onChange,
}: {
  value: string | null;
  isDisabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const parsed = siteReferenceUrlSchema.safeParse(draft);
  const invalid = draft.trim().length > 0 && !parsed.success;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!parsed.success) {
      return;
    }

    onChange(parsed.data);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setDraft(value ?? "");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={value ? "secondary" : "ghost"}
          disabled={isDisabled}
          icon={<Palette className="h-3.5 w-3.5" aria-hidden="true" />}
          title={value ? `Colours and fonts from ${value}` : "Borrow colours and fonts from a site"}
        >
          {value ? new URL(value).hostname : "Look like"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-1rem)]">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <p className="font-medium">Reference site</p>
            <p className="text-xs text-muted-foreground">
              The next build borrows its colours and fonts. Layout and copy stay your own.
            </p>
          </div>
          <Input
            type="url"
            inputMode="url"
            placeholder="https://example.com"
            value={draft}
            aria-label="Reference site URL"
            aria-invalid={invalid}
            onChange={(event) => setDraft(event.target.value)}
          />
          {invalid && <p className="text-xs text-failure">Use a public HTTPS address.</p>}
          <div className="flex justify-end gap-2">
            {value && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            )}
            <Button type="submit" size="sm" disabled={!parsed.success}>
              Use
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
