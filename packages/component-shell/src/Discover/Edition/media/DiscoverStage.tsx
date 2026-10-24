import { Button } from "@ngriffin_uk/polychat-component-ui";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function DiscoverStage({
  eyebrow,
  title,
  subtitle,
  onClose,
  children,
}: {
  eyebrow: ReactNode;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-5 pb-12 sm:px-8 lg:pt-8">
        <div className="flex items-start gap-3">
          <Button
            variant="icon"
            size="icon"
            aria-label="Back to the edition"
            className="-ml-2 lg:hidden"
            onClick={onClose}
          >
            <ArrowLeft size={16} aria-hidden />
          </Button>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="polychat-eyebrow">{eyebrow}</p>
            <h2 className="font-display text-2xl leading-tight font-medium tracking-tight text-balance text-foreground xl:text-3xl">
              {title}
            </h2>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
