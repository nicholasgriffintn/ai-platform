import { Button, Card, DropdownMenu, DropdownMenuItem } from "@ngriffin_uk/polychat-component-ui";
import {
  CalendarClock,
  CalendarX2,
  Ellipsis,
  Eye,
  PauseCircle,
  PlayCircle,
  Plus,
  Settings2,
} from "lucide-react";

export interface ScheduledRecipeEntry {
  id: string;
  title: string;
  cronExpression?: string;
  isPaused: boolean;
  memberName: string;
  canManage: boolean;
  isUpdating: boolean;
  canViewConfiguration: boolean;
}

export interface ScheduledRecipeListProps {
  entries: ScheduledRecipeEntry[];
  embedded?: boolean;
  canSchedule: boolean;
  onSchedule: () => void;
  onViewConfiguration: (entryId: string) => void;
  onEditSchedule: (entryId: string) => void;
  onToggleEnabled: (entryId: string, enabled: boolean) => void;
  onStopSchedule: (entryId: string) => void;
}

export function ScheduledRecipeList({
  entries,
  embedded = false,
  canSchedule,
  onSchedule,
  onViewConfiguration,
  onEditSchedule,
  onToggleEnabled,
  onStopSchedule,
}: ScheduledRecipeListProps) {
  const content = (
    <section
      className={`space-y-4 p-5 ${embedded ? "border-t border-zinc-100 dark:border-zinc-800" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <CalendarClock size={17} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Scheduled recipes</h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Runs appear as conversations in this project.
            </p>
          </div>
        </div>
        <Button
          variant="icon"
          size="icon"
          icon={<Plus size={16} />}
          aria-label="Schedule a project recipe"
          disabled={!canSchedule}
          onClick={onSchedule}
        />
      </div>

      {entries.length ? (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-100 px-3 py-2.5 dark:border-zinc-800"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  {entry.cronExpression} · {entry.isPaused ? "paused" : "active"} ·{" "}
                  {entry.memberName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {entry.canViewConfiguration ? (
                  <Button
                    variant="icon"
                    size="icon"
                    icon={<Eye size={15} />}
                    aria-label={`View ${entry.title} configuration`}
                    onClick={() => onViewConfiguration(entry.id)}
                  />
                ) : null}
                {entry.canManage && entry.canViewConfiguration ? (
                  <DropdownMenu
                    position="left"
                    buttonProps={{
                      "aria-label": `Manage ${entry.title} schedule`,
                      disabled: entry.isUpdating,
                      size: "icon",
                      variant: "icon",
                    }}
                    trigger={<Ellipsis size={16} />}
                  >
                    <DropdownMenuItem
                      icon={<Settings2 size={15} />}
                      onClick={() => onEditSchedule(entry.id)}
                    >
                      Edit schedule
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      icon={entry.isPaused ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
                      onClick={() => onToggleEnabled(entry.id, entry.isPaused)}
                    >
                      {entry.isPaused ? "Resume schedule" : "Pause schedule"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-700 dark:text-red-300"
                      icon={<CalendarX2 size={15} />}
                      onClick={() => onStopSchedule(entry.id)}
                    >
                      Stop schedule
                    </DropdownMenuItem>
                  </DropdownMenu>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No recipes are scheduled for this project.</p>
      )}
    </section>
  );

  if (embedded) {
    return content;
  }

  return <Card className="gap-0 overflow-hidden py-0 shadow-none">{content}</Card>;
}
