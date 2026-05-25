/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,mdx}",
    "./components/**/*.{js,jsx,mdx}",
    "./context/**/*.{js,jsx,mdx}",
    "./lib/**/*.{js,jsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        travelport: {
          black: "#000000",
          ink: "#0B0B0B",
          softBlack: "#171717",
          charcoal: "#2A2A2A",
          white: "#FFFFFF",
          gray: {
            50: "#F7F8FA",
            100: "#EBEDF0",
            200: "#D1D5DB",
            300: "#9CA3AF",
            500: "#6B7280",
            700: "#374151",
            900: "#111827",
          },
        },
      },
      boxShadow: {
        soft: "0 6px 24px rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
};
