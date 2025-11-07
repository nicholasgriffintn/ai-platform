import { useEffect, useRef, useState, useCallback } from "react";
import { prebake } from "./strudel";
import { Play, Pause } from "lucide-react";

import { Button } from "~/components/ui/Button";

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
}

export function StrudelPlayer({ code, title, subtitle }: StrudelPlayerProps) {
	const [isInitialized, setIsInitialized] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [bpm, setBpm] = useState(120);

	const strudelRef = useRef<Awaited<ReturnType<typeof prebake>> | null>(null);
	const editorRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		let mounted = true;

		async function initialize() {
			try {
				const strudel = await prebake();
				if (!mounted) return;

				strudelRef.current = strudel;

				strudel.evaluate(`setcps(${120} / 60 / 4);`);

				setIsInitialized(true);
			} catch (err) {
				if (!mounted) return;
				setError(
					err instanceof Error ? err.message : "Failed to initialize Strudel",
				);
			}
		}

		initialize();

		return () => {
			mounted = false;
			if (strudelRef.current) {
				strudelRef.current.stop();
			}
		};
	}, []);

	useEffect(() => {
		if (editorRef.current) {
			editorRef.current.value = sanitizeStrudelCode(code);
		}
	}, [code]);

	const applyTempo = useCallback((nextBpm: number) => {
		const strudel = strudelRef.current;
		if (!strudel) return;
		try {
			strudel.evaluate(`setcps(${nextBpm} / 60 / 4);`);
		} catch (e) {
			console.error("Failed to set tempo", e);
		}
	}, []);

	const handlePlay = useCallback(() => {
		const strudel = strudelRef.current;
		const editor = editorRef.current;
		if (!strudel || !editor) return;

		try {
			applyTempo(bpm);
			strudel.evaluate(editor.value);
			setIsPlaying(true);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Evaluation error");
		}
	}, [applyTempo, bpm]);

	const handlePause = useCallback(() => {
		const strudel = strudelRef.current;
		if (!strudel) return;

		strudel.stop();
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

					<div className="flex items-center gap-2">
						<Button
							size="icon"
							variant="ghost"
							onClick={handlePlay}
							disabled={!isInitialized || isPlaying}
							aria-label={isPlaying ? "update" : "play"}
							className="h-7 w-7 rounded-full hover:bg-emerald-500/20"
						>
							<Play className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="icon"
							variant="ghost"
							onClick={handlePause}
							disabled={!isInitialized || !isPlaying}
							aria-label="pause"
							className="h-7 w-7 rounded-full hover:bg-rose-500/20"
						>
							<Pause className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>

				<div className="flex flex-col sm:flex-row gap-3 px-3 pt-2 pb-1 border-b border-slate-800/70 bg-slate-900/70">
					<div className="flex items-center gap-2 text-xs text-slate-300">
						<span className="font-mono uppercase tracking-wide text-[10px] text-slate-400">
							BPM
						</span>
						<input
							type="range"
							min={60}
							max={180}
							value={bpm}
							onChange={(e) => {
								const next = Number(e.target.value);
								setBpm(next);
								applyTempo(next);
							}}
							className="w-28 accent-emerald-400"
						/>
						<span className="w-10 text-right tabular-nums">{bpm}</span>
					</div>

					<div className="flex-1 flex items-center justify-end text-[11px] text-slate-400">
						{!isInitialized && !error && (
							<span>Initializing audio engine…</span>
						)}
						{isPlaying && (
							<span className="text-emerald-300">Playing current pattern</span>
						)}
					</div>
				</div>

				<textarea
					ref={editorRef}
					defaultValue={code}
					className="w-full min-h-[320px] p-4 font-mono text-sm bg-transparent text-slate-100 resize-none focus:outline-none"
					spellCheck={false}
				/>

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
