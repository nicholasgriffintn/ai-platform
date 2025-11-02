/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				"off-white": "#f8f8f8",
				"off-white-highlight": "#e8eaed",
			},
			typography: {
				DEFAULT: {
					css: {
						pre: {
							padding: "0",
							filter: "brightness(96%)",
							border: "0",
							backgroundColor: "transparent",
						},
					},
				},
			},
			keyframes: {
				"accordion-down": {
					from: { height: 0 },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: 0 },
				},
				gleam: {
					"0%": { transform: "translateX(-100%)" },
					"100%": { transform: "translateX(100%)" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				gleam: "gleam 2s ease-in-out infinite",
			},
		},
	},
	plugins: [require("@tailwindcss/typography")],
};
