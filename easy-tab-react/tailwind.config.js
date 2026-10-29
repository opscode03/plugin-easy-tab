/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg)",
        surface: "var(--surface)",
        sage: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          soft: "var(--soft)"
        },
        ink: {
          DEFAULT: "var(--text)",
          muted: "var(--text-sub)"
        },
        line: "var(--border)",
        danger: "var(--danger)"
      },
      fontFamily: {
        display: ["Iowan Old Style", "Palatino Linotype", "Noto Serif SC", "serif"],
        body: ["Avenir Next", "Segoe UI", "PingFang SC", "Microsoft YaHei", "sans-serif"]
      },
      boxShadow: {
        search: "var(--shadow-search)",
        dialog: "var(--shadow-dialog)"
      }
    }
  },
  plugins: []
};
