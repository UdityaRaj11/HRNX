/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/webview/**/*.{js,ts,jsx,tsx,html}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        vscode: {
          bg: "var(--vscode-editor-background)",
          fg: "var(--vscode-editor-foreground)",
          sidebar: "var(--vscode-sideBar-background)",
          panel: "var(--vscode-panel-background)",
          border: "var(--vscode-panel-border)",
          inputBg: "var(--vscode-input-background)",
          inputFg: "var(--vscode-input-foreground)",
          inputBorder: "var(--vscode-input-border)",
          buttonBg: "var(--vscode-button-background)",
          buttonFg: "var(--vscode-button-foreground)",
          buttonHover: "var(--vscode-button-hoverBackground)",
          badgeBg: "var(--vscode-badge-background)",
          badgeFg: "var(--vscode-badge-foreground)",
          accent: "var(--vscode-focusBorder)",
          error: "var(--vscode-errorForeground)",
          warning: "var(--vscode-editorWarning-foreground)",
          info: "var(--vscode-editorInfo-foreground)",
        }
      }
    },
  },
  plugins: [],
}
