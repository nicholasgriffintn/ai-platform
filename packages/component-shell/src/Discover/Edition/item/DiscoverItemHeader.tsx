import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Maximize2,
  MoreHorizontal,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";

import { hasDiscoverTopic } from "../discover-card-drafts.js";
import type { DiscoverItemKind } from "./discover-item-kind.js";
import {
  DiscoverCardMenu,
  DiscoverSaveButton,
  type DiscoverCardTarget,
} from "./DiscoverCardActions.js";

export interface DiscoverItemNavigation {
  position: string | null;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}

export function DiscoverItemHeader({
  kind,
  navigation,
  target = null,
  menu,
  pageHref,
}: {
  kind: DiscoverItemKind;
  navigation: DiscoverItemNavigation;
  target?: DiscoverCardTarget | null;
  menu?: ReactNode;
  pageHref: string | null;
}) {
  const navigate = useNavigate();
  const Icon = kind.icon;

  return (
    <header className="flex h-13 shrink-0 items-center gap-1 border-b border-border pr-3 pl-3 lg:pl-5">
      <Button
        variant="icon"
        size="sm"
        aria-label="Back to Discover"
        className="lg:hidden"
        icon={<ArrowLeft size={16} aria-hidden />}
        onClick={navigation.onClose}
      />
      <Icon size={15} className="hidden shrink-0 text-muted-foreground lg:block" aria-hidden />
      <p className="polychat-eyebrow ml-1.5 truncate">{kind.label}</p>
      {navigation.position ? (
        <span className="ml-2 hidden shrink-0 text-xs text-muted-foreground/80 tabular-nums sm:inline">
          {navigation.position}
        </span>
      ) : null}
      <span className="flex-1" />
      <Button
        variant="icon"
        size="sm"
        aria-label="Previous item"
        title="Previous item"
        disabled={!navigation.onPrev}
        icon={<ChevronUp size={15} aria-hidden />}
        onClick={navigation.onPrev}
      />
      <Button
        variant="icon"
        size="sm"
        aria-label="Next item"
        title="Next item"
        disabled={!navigation.onNext}
        icon={<ChevronDown size={15} aria-hidden />}
        onClick={navigation.onNext}
      />
      <span aria-hidden className="mx-1.5 h-4.5 w-px bg-border" />
      {target ? (
        <DiscoverSaveButton {...target} />
      ) : (
        <Button
          variant="icon"
          size="sm"
          aria-label="Save"
          disabled
          icon={<Bookmark size={15} aria-hidden />}
        />
      )}
      {menu ??
        (target && hasDiscoverTopic(target.card) ? (
          <DiscoverCardMenu {...target} />
        ) : (
          <Button
            variant="icon"
            size="sm"
            aria-label="More options"
            disabled
            icon={<MoreHorizontal size={15} aria-hidden />}
          />
        ))}
      <Button
        variant="icon"
        size="sm"
        aria-label="Open as a page"
        title={pageHref ? "Open as a page" : "Nothing to open yet"}
        disabled={!pageHref}
        icon={<Maximize2 size={15} aria-hidden />}
        onClick={() => pageHref && void navigate(pageHref)}
      />
      <Button
        variant="icon"
        size="sm"
        aria-label="Close"
        title="Close (Esc)"
        className="hidden lg:inline-flex"
        icon={<X size={16} aria-hidden />}
        onClick={navigation.onClose}
      />
    </header>
  );
}
