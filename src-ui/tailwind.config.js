const { heroui } = require('@heroui/react')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: { extend: {} },
  darkMode: 'class',
  plugins: [heroui({
    themes: {
      light: {
        colors: {
          primary: { DEFAULT: '#7c6df3', foreground: '#ffffff' },
          secondary: { DEFAULT: '#a855f7', foreground: '#ffffff' },
          success: { DEFAULT: '#22d3a0', foreground: '#ffffff' },
          warning: { DEFAULT: '#fbbf24', foreground: '#1a1f36' },
          danger: { DEFAULT: '#f87171', foreground: '#ffffff' },
        },
      },
      dark: {
        colors: {
          background: '#0a0f1e',
          foreground: '#f0f4ff',
          primary: { DEFAULT: '#7c6df3', foreground: '#ffffff' },
          secondary: { DEFAULT: '#a855f7', foreground: '#ffffff' },
          success: { DEFAULT: '#22d3a0', foreground: '#ffffff' },
          warning: { DEFAULT: '#fbbf24', foreground: '#1a1f36' },
          danger: { DEFAULT: '#f87171', foreground: '#ffffff' },
          content1: '#111827',
          content2: '#1a2235',
          content3: '#222b3d',
          content4: '#2a3548',
          focus: '#7c6df3',
        },
      },
    },
  })],
}
