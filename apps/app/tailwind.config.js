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
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
