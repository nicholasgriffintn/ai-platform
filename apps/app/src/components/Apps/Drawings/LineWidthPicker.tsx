import { LINE_WIDTHS } from "./constants";

interface LineWidthPickerProps {
	lineWidth: number;
	setLineWidth: (width: number) => void;
}

export function LineWidthPicker({
	lineWidth,
	setLineWidth,
}: LineWidthPickerProps) {
	return (
		<>
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<label htmlFor="line-width" className="text-sm font-medium">
						Line Width
					</label>
					<span className="text-sm text-muted-foreground">{lineWidth}px</span>
				</div>
				<div className="grid grid-cols-3 gap-2">
					{LINE_WIDTHS.map((width) => (
						<button
							type="button"
							key={width}
							onClick={() => setLineWidth(width)}
							className={`
                p-2 h-12 rounded-md flex items-center justify-center
                transition-all duration-200
                ${
									lineWidth === width
										? "bg-primary/10 border-2 border-primary shadow-sm scale-105 outline outline-[2px solid #3b82f6]"
										: "border border-muted hover:border-primary/50 hover:bg-muted"
								}
              `}
							title={`${width}px`}
						>
							<div className="w-full flex items-center justify-center">
								<div
									className="rounded-full bg-foreground"
									style={{
										width: `${width}px`,
										height: `${width}px`,
									}}
								/>
							</div>
						</button>
					))}
				</div>
			</div>

			<div className="p-3 border rounded-md bg-background">
				<div className="w-full h-[2px] bg-muted" />
				<div
					className="w-full rounded-full bg-foreground transition-all duration-200"
					style={{
						height: `${lineWidth}px`,
						marginTop: "8px",
					}}
				/>
			</div>
		</>
	);
}
