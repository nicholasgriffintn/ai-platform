export function loadExternalScript({ id, src }: { id: string; src: string }): Promise<void> {
	const existingElement = document.getElementById(id);
	if (existingElement instanceof HTMLScriptElement) {
		if (existingElement.dataset.loaded === "true") {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			existingElement.addEventListener(
				"load",
				() => {
					existingElement.dataset.loaded = "true";
					resolve();
				},
				{ once: true },
			);
			existingElement.addEventListener(
				"error",
				() => reject(new Error(`Failed to load script: ${src}`)),
				{ once: true },
			);
		});
	}

	return new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.id = id;
		script.src = src;
		script.async = true;
		script.addEventListener(
			"load",
			() => {
				script.dataset.loaded = "true";
				resolve();
			},
			{ once: true },
		);
		script.addEventListener("error", () => reject(new Error(`Failed to load script: ${src}`)), {
			once: true,
		});
		document.head.appendChild(script);
	});
}
