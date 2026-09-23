import { SitePropsForm } from "@ngriffin_uk/polychat-component-sites";
import { Badge, Button } from "@ngriffin_uk/polychat-component-ui";
import {
  buildDuplicateSiteElementPatches,
  buildMoveSiteElementPatches,
  buildRemoveSiteElementPatches,
  buildSitePropsPatch,
  findSiteElementParent,
  isSiteComponentType,
  listSiteElementAncestors,
} from "@ngriffin_uk/polychat-library-sites";
import type { SitePage, SitePatch } from "@ngriffin_uk/polychat-schemas";
import { ArrowDown, ArrowUp, Copy, Trash2, X } from "lucide-react";

export interface SiteInspectorProps {
  pageId: string;
  page: SitePage;
  elementKey: string;
  onSelect: (key: string | null) => void;
  onEdit: (patches: SitePatch[], summary: string) => void;
}

export function SiteInspector({ pageId, page, elementKey, onSelect, onEdit }: SiteInspectorProps) {
  const element = page.elements[elementKey];

  if (!element || !isSiteComponentType(element.type)) {
    return null;
  }

  const ancestors = listSiteElementAncestors(page, elementKey);
  const parent = findSiteElementParent(page, elementKey);
  const siblings = parent ? page.elements[parent].children : [];
  const position = siblings.indexOf(elementKey);
  const isRoot = elementKey === page.root;

  return (
    <aside className="flex h-full min-h-0 w-80 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto text-xs text-muted-foreground">
          {ancestors.map((key, index) => (
            <span key={key} className="flex shrink-0 items-center gap-1">
              {index > 0 && <span aria-hidden="true">/</span>}
              <button
                type="button"
                onClick={() => onSelect(key)}
                className={
                  key === elementKey ? "font-medium text-foreground" : "hover:text-foreground"
                }
              >
                {page.elements[key]?.type ?? key}
              </button>
            </span>
          ))}
        </div>
        <Button
          variant="icon"
          size="icon"
          aria-label="Close inspector"
          icon={<X size={14} />}
          onClick={() => onSelect(null)}
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-xs">{elementKey}</span>
          <Badge variant="secondary">{element.type}</Badge>
        </div>
        {!isRoot && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="icon"
              size="icon"
              aria-label="Move up"
              disabled={position <= 0}
              icon={<ArrowUp size={14} />}
              onClick={() =>
                onEdit(
                  buildMoveSiteElementPatches(page, pageId, elementKey, "up"),
                  `Moved ${element.type} up`,
                )
              }
            />
            <Button
              variant="icon"
              size="icon"
              aria-label="Move down"
              disabled={position < 0 || position >= siblings.length - 1}
              icon={<ArrowDown size={14} />}
              onClick={() =>
                onEdit(
                  buildMoveSiteElementPatches(page, pageId, elementKey, "down"),
                  `Moved ${element.type} down`,
                )
              }
            />
            <Button
              variant="icon"
              size="icon"
              aria-label="Duplicate"
              icon={<Copy size={14} />}
              onClick={() =>
                onEdit(
                  buildDuplicateSiteElementPatches(page, pageId, elementKey),
                  `Duplicated ${element.type}`,
                )
              }
            />
            <Button
              variant="icon"
              size="icon"
              aria-label="Remove"
              icon={<Trash2 size={14} />}
              onClick={() => {
                onEdit(
                  buildRemoveSiteElementPatches(page, pageId, elementKey),
                  `Removed ${element.type}`,
                );
                onSelect(parent);
              }}
            />
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-4">
        <SitePropsForm
          type={element.type}
          props={element.props}
          onChange={(props) =>
            onEdit([buildSitePropsPatch(pageId, elementKey, props)], `Edited ${element.type}`)
          }
        />
        {element.children.length > 0 && (
          <div className="mt-4 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Children</span>
            <ul className="flex flex-col gap-0.5">
              {element.children.map((child) => (
                <li key={child}>
                  <button
                    type="button"
                    onClick={() => onSelect(child)}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-accent"
                  >
                    <span className="font-mono">{child}</span>
                    <span className="text-muted-foreground">{page.elements[child]?.type}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
