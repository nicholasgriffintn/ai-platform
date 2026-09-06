import { Button } from "@ngriffin_uk/polychat-component-ui";
import { Play, Pause } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

import { loadStrudelRuntime, sanitizeStrudelCode } from "./strudel";

interface StrudelMirrorInstance {
  code: string;
  evaluate: (autostart?: boolean) => Promise<void>;
  stop: () => Promise<void>;
  setCode: (code: string) => void;
  clear: () => void;
  setTheme?: (theme: string) => void;
}

interface StrudelPlayerProps {
  code: string;
  title?: string;
  subtitle?: string;
  readOnly?: boolean;
  onChange?: (code: string) => void;
}

export function StrudelPlayer({
  code,
  title,
  subtitle,
  readOnly = false,
  onChange,
}: StrudelPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRuntimeLoading, setIsRuntimeLoading] = useState(false);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<StrudelMirrorInstance | null>(null);
  const editorLoadPromiseRef = useRef<Promise<StrudelMirrorInstance | null> | null>(null);
  const isMountedRef = useRef(false);
  const latestCodeRef = useRef(code);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    latestCodeRef.current = code;
    onChangeRef.current = onChange;
  }, [code, onChange]);

  const createEditor = useCallback(async () => {
    if (editorRef.current) {
      return editorRef.current;
    }

    if (editorLoadPromiseRef.current) {
      return editorLoadPromiseRef.current;
    }

    const root = editorContainerRef.current;

    if (!root) {
      return null;
    }

    editorLoadPromiseRef.current = (async () => {
      setIsRuntimeLoading(true);

      try {
        const { StrudelMirror, getAudioContext, webaudioOutput, transpiler, prebake } =
          await loadStrudelRuntime();

        if (!isMountedRef.current || editorRef.current || editorContainerRef.current !== root) {
          return editorRef.current;
        }

        const editor = new StrudelMirror({
          theme: "teletext",
          defaultOutput: webaudioOutput,
          getTime: () => getAudioContext().currentTime,
          transpiler,
          root,
          initialCode: sanitizeStrudelCode(latestCodeRef.current),
          drawTime: [-2, 2],
          prebake,
          onChange: (update: {
            docChanged: boolean;
            state: { doc: { toString: () => string } };
          }) => {
            if (!readOnly && update.docChanged) {
              onChangeRef.current?.(update.state.doc.toString());
            }
          },
        });

        editor.setTheme?.("tokyoNight");
        editorRef.current = editor;
        setError(null);

        return editor;
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : "Unable to load Strudel runtime");
        }

        return null;
      } finally {
        if (isMountedRef.current) {
          setIsRuntimeLoading(false);
        }

        editorLoadPromiseRef.current = null;
      }
    })();

    return editorLoadPromiseRef.current;
  }, [readOnly]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (editorRef.current) {
        void editorRef.current.stop();
        editorRef.current.clear();
        editorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!readOnly) {
      void createEditor();
    }
  }, [createEditor, readOnly]);

  useEffect(() => {
    if (editorRef.current) {
      const sanitized = sanitizeStrudelCode(code);

      if (editorRef.current.code !== sanitized) {
        editorRef.current.setCode(sanitized);
      }
    }
  }, [code]);

  const handlePlay = useCallback(async () => {
    const editor = editorRef.current ?? (await createEditor());

    if (!editor) {
      return;
    }

    try {
      await editor.evaluate();
      setIsPlaying(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation error");
    }
  }, [createEditor]);

  const handlePause = useCallback(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    void editor.stop();
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "Enter") {
        e.preventDefault();
        void handlePlay();
      } else if (e.altKey && (e.key === "." || e.key === "≥")) {
        e.preventDefault();
        handlePause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlay, handlePause]);

  return (
    <div className="w-full">
      {title || subtitle ? (
        <div className="mb-3 flex flex-col gap-1 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {title && <h3 className="text-base font-semibold sm:text-lg">{title}</h3>}
            {isPlaying && (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                Live
              </span>
            )}
          </div>
          {subtitle && <span className="text-xs text-muted-foreground sm:text-sm">{subtitle}</span>}
        </div>
      ) : null}

      <div className="relative w-full overflow-hidden rounded-xl border bg-gradient-to-b from-canvas via-canvas/95 to-canvas/90 shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b border-border/80 bg-surface/80 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
              Strudel Live Code
            </span>
          </div>

          <div className="flex flex-1 items-center justify-end text-[11px] text-muted-foreground">
            {isPlaying && <span className="text-success">Playing current pattern</span>}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={handlePlay}
              disabled={isPlaying || isRuntimeLoading}
              aria-label={isPlaying ? "update" : "play"}
              className="h-7 w-7 rounded-full hover:bg-success/20"
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handlePause}
              disabled={!isPlaying}
              aria-label="pause"
              className="h-7 w-7 rounded-full hover:bg-failure/20"
            >
              <Pause className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {readOnly ? (
          <div>
            <pre className="overflow-x-auto bg-surface/80 p-4 font-mono text-xs sm:text-sm">
              {code}
            </pre>
            <div ref={editorContainerRef} className="sr-only" aria-hidden="true" />
          </div>
        ) : (
          <div ref={editorContainerRef} className="min-h-[320px] w-full" />
        )}

        {error && (
          <div className="border-t border-destructive/20 bg-destructive/10 px-3 py-2">
            <p className="font-mono text-[11px] text-destructive">{error}</p>
          </div>
        )}
      </div>

      {readOnly ? (
        <p className="mt-2 text-xs text-muted-foreground sm:mt-3 sm:text-sm">
          Press play to load the Strudel runtime and listen in your browser.
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground sm:mt-3 sm:text-sm">
          The Strudel REPL runs entirely in your browser. Edit the code and press{" "}
          <span className="font-mono text-[11px]">Alt+Enter</span> to play,{" "}
          <span className="font-mono text-[11px]">Alt+.</span> to pause.
        </p>
      )}
    </div>
  );
}
