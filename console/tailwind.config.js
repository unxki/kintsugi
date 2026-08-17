/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#050505",
          surface: "#0c0c0c",
          panel: "#121212",
          border: "#1e1e1e",
          borderHover: "#333333",
          green: "#00ff41",
          greenDim: "rgba(0, 255, 65, 0.12)",
          greenGlow: "rgba(0, 255, 65, 0.25)",
          amber: "#f59e0b",
          amberDim: "rgba(245, 158, 11, 0.12)",
          red: "#ef4444",
          redDim: "rgba(239, 68, 68, 0.12)",
          cyan: "#06b6d4",
          textPrimary: "#f3f4f6",
          textSecondary: "#9ca3af",
          textMuted: "#4b5563",
        },
      },
      fontFamily: {
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          '"Cascadia Code"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink': 'blink 1.2s infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        }
      },
      boxShadow: {
        'terminal-glow': '0 0 20px rgba(0, 255, 65, 0.15)',
        'red-glow': '0 0 20px rgba(239, 68, 68, 0.2)',
      },
    },
  },
  plugins: [],
}
