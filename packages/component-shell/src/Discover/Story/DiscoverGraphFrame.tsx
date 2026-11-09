import { LoadingSpinner } from "@ngriffin_uk/polychat-component-ui";
import { ApiError } from "@ngriffin_uk/polychat-library-client";
import type { ReactNode, Ref } from "react";

import type { DiscoverItemKind } from "../Edition/item/discover-item-kind.js";
import { DiscoverItemHeader } from "../Edition/item/DiscoverItemHeader.js";

export function DiscoverGraphHeader({
  kind,
  pageHref = null,
  onClose,
}: {
  kind: DiscoverItemKind;
  pageHref?: string | null;
  onClose: () => void;
}) {
  return (
    <DiscoverItemHeader kind={kind} navigation={{ position: null, onClose }} pageHref={pageHref} />
  );
}

export function DiscoverGraphFrame({
  kind,
  itemKey,
  contentRef,
  onClose,
  children,
}: {
  kind: DiscoverItemKind;
  itemKey: string;
  contentRef: Ref<HTMLDivElement>;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <DiscoverGraphHeader kind={kind} onClose={onClose} />
      <div
        ref={contentRef}
        data-discover-panel-item={itemKey}
        className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-x-hidden overflow-y-auto"
      >
        <div className="px-4 pt-5 pb-10 sm:px-6">{children}</div>
      </div>
    </>
  );
}

export function DiscoverGraphStatus({
  error,
  missing,
  failed,
}: {
  error: unknown;
  missing: string;
  failed: string;
}) {
  if (!error) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <p className="py-10 text-center text-sm text-muted-foreground">
      {error instanceof ApiError && error.status === 404 ? missing : failed}
    </p>
  );
}
