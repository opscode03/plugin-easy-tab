/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg)",
        surface: "var(--surface)",
        panel: {
          1: "var(--panel-1)",
          2: "var(--panel-2)"
        },
        menu: "var(--menu-bg)",
        ink: {
          DEFAULT: "var(--text)",
          muted: "var(--text-sub)",
          faint: "var(--text-faint)"
        },
        line: "var(--line)",
        divider: "var(--divider)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          ink: "var(--accent-ink)"
        },
        danger: "var(--danger)"
      },
      fontFamily: {
        display: ["Segoe UI Variable Display", "Segoe UI", "PingFang SC", "Microsoft YaHei", "system-ui", "sans-serif"],
        body: ["Segoe UI", "PingFang SC", "Microsoft YaHei", "system-ui", "sans-serif"],
        clock: ["Segoe UI Variable Display", "SF Pro Display", "Segoe UI", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
