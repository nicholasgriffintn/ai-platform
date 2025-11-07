import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { StrudelMirror } from "@strudel/codemirror";
// @ts-expect-error - @strudel/webaudio has no type definitions
import { getAudioContext, webaudioOutput } from "@strudel/webaudio";
// @ts-expect-error - @strudel/transpiler has no type definitions
import { transpiler } from "@strudel/transpiler";

import { Button } from "~/components/ui/Button";
import { prebake } from "./strudel";

interface StrudelMirrorInstance {
	code: string;
	evaluate: (arg?: string) => Promise<void>;
	stop: () => void;
	setCode: (code: string) => void;
}

export function sanitizeStrudelCode(code: string): string {
	return code
		.replace(/"([^"]*)"/g, (_, content) => {
			const sanitized = content.replace(
				/[^a-zA-Z0-9~*\/!?\[\]@<>\(\),:\.\^\_\-\s]/g,
				"",
			);
			return `"${sanitized}"`;
		})
		.replace(/;+/g, "")
		.replace(/```[a-z]*|```/g, "")
		.trim();
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

	const editorContainerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<StrudelMirrorInstance | null>(null);

	useEffect(() => {
		if (!editorContainerRef.current || editorRef.current) return;

		// @ts-expect-error - StrudelMirror is a class but TS sees it as a React component
		const editor = new StrudelMirror({
			theme: "teletext",
			defaultOutput: webaudioOutput,
			getTime: () => getAudioContext().currentTime,
			transpiler,
			root: editorContainerRef.current,
			initialCode: sanitizeStrudelCode(code),
			drawTime: [-2, 2],
			prebake,
			onChange: (update: any) => {
				if (update.docChanged) {
					onChange?.(update.state.doc.toString());
				}
			},
		});

		editor.setTheme("tokyoNight");

		editorRef.current = editor;

		return () => {
			if (editorRef.current) {
				editorRef.current.stop();
			}
		};
	}, []);

	useEffect(() => {
		if (editorRef.current) {
			const sanitized = sanitizeStrudelCode(code);
			if (editorRef.current.code !== sanitized) {
				editorRef.current.setCode(sanitized);
			}
		}
	}, [code]);

	const handlePlay = useCallback(async () => {
		const editor = editorRef.current;
		if (!editor) return;

		try {
			await editor.evaluate();
			setIsPlaying(true);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Evaluation error");
		}
	}, []);

	const handlePause = useCallback(() => {
		const editor = editorRef.current;
		if (!editor) return;

		editor.stop();
		setIsPlaying(false);
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.altKey && e.key === "Enter") {
				e.preventDefault();
				handlePlay();
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
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-1">
					<div className="flex items-center gap-2">
						{title && (
							<h3 className="text-base sm:text-lg font-semibold">{title}</h3>
						)}
						{isPlaying && (
							<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/40">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
								Live
							</span>
						)}
					</div>
					{subtitle && (
						<span className="text-xs sm:text-sm text-muted-foreground">
							{subtitle}
						</span>
					)}
				</div>
			) : null}

			<div className="relative w-full rounded-xl border bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-950/90 overflow-hidden shadow-lg shadow-slate-900/40">
				<div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800/80 bg-slate-900/80">
					<div className="flex items-center gap-2">
						<span className="text-xs font-mono uppercase tracking-wide text-slate-400">
							Strudel Live Code
						</span>
					</div>

					<div className="flex-1 flex items-center justify-end text-[11px] text-slate-400">
						{isPlaying && (
							<span className="text-emerald-300">Playing current pattern</span>
						)}
					</div>

					<div className="flex items-center gap-2">
						<Button
							size="icon"
							variant="ghost"
							onClick={handlePlay}
							disabled={isPlaying}
							aria-label={isPlaying ? "update" : "play"}
							className="h-7 w-7 rounded-full hover:bg-emerald-500/20"
						>
							<Play className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="icon"
							variant="ghost"
							onClick={handlePause}
							disabled={!isPlaying}
							aria-label="pause"
							className="h-7 w-7 rounded-full hover:bg-rose-500/20"
						>
							<Pause className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>

				{readOnly ? (
					<div>
						<pre className="p-4 overflow-x-auto text-xs sm:text-sm font-mono bg-slate-900/80">
							{code}
						</pre>
					</div>
				) : (
					<div ref={editorContainerRef} className="w-full min-h-[320px]" />
				)}

				{error && (
					<div className="px-3 py-2 bg-destructive/10 border-t border-destructive/20">
						<p className="text-[11px] text-destructive font-mono">{error}</p>
					</div>
				)}
			</div>

			<p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3">
				The Strudel REPL runs entirely in your browser. Edit the code and press{" "}
				<span className="font-mono text-[11px]">Alt+Enter</span> to play,{" "}
				<span className="font-mono text-[11px]">Alt+.</span> to pause.
			</p>
		</div>
	);
}
