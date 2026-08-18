/** @type {import('tailwindcss').Config} */
const reactDomPreset = {
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
        flutter: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "20%": { transform: "rotate(-4deg)" },
          "45%": { transform: "rotate(3deg)" },
          "70%": { transform: "rotate(-2deg)" },
          "90%": { transform: "rotate(1deg)" },
        },
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        gleam: "gleam 2s ease-in-out infinite",
        flutter: "flutter 0.9s ease-in-out",
        bob: "bob 3s ease-in-out infinite",
      },
    },
  },
};

module.exports = reactDomPreset;
