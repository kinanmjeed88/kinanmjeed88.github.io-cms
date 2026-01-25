/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        surface: '#1e293b',
        primary: '#3b82f6',
        accent: '#8b5cf6',
      },
      fontFamily: { sans: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'] }
    },
  },
  plugins: [],
}