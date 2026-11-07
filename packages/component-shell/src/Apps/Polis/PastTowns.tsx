import { Button } from "@ngriffin_uk/polychat-component-ui";
import { YEAR_DAYS } from "@ngriffin_uk/polychat-library-polis";
import { formatCompactCount } from "@ngriffin_uk/polychat-utility-core";
import { FileUp, Film, Play, Trash2 } from "lucide-react";
import { type ChangeEvent, useState } from "react";

import { readRecording } from "./recording-file.js";
import type { PolisEngine } from "./usePolisEngine.js";

export function PastTowns({ engine }: { engine: PolisEngine }) {
  const [error, setError] = useState<string | null>(null);

  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    setError(null);

    if (!file) {
      return;
    }

    try {
      engine.send({ type: "import", recording: await readRecording(file), watch: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That file could not be read");
    }
  };

  return (
    <section className="space-y-2 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Past towns</h3>
        <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <FileUp size={12} />
          <span>Open a recording</span>
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(event) => void openFile(event)}
          />
        </label>
      </div>
      {error && <p className="text-xs text-failure">{error}</p>}
      {engine.recordings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Every town is recorded as it runs, so you can come back and watch it later.
        </p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {engine.recordings.map((recording) => (
            <li key={recording.id} className="flex items-center gap-1">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{recording.name}</span>
                <span className="block font-mono text-[11px] text-muted-foreground tabular-nums">
                  {Math.floor(recording.day / YEAR_DAYS) + 1} years ·{" "}
                  {formatCompactCount(recording.population)} people
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                icon={<Film size={12} />}
                onClick={() => engine.send({ type: "open", id: recording.id, watch: true })}
              >
                Watch
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                icon={<Play size={12} />}
                onClick={() => engine.send({ type: "open", id: recording.id, watch: false })}
              >
                Carry on
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Delete ${recording.name}`}
                onClick={() => engine.send({ type: "forget", id: recording.id })}
              >
                <Trash2 size={12} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
