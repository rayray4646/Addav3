/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          DEFAULT: 'var(--orange)',
          dim: 'var(--orange-dim)',
          mid: 'var(--orange-mid)',
        },
        navy: 'var(--navy)',
        mid: 'var(--mid)',
        light: 'var(--light)',
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        teal: {
          DEFAULT: 'var(--teal)',
          bg: 'var(--teal-bg)',
        },
        green: {
          DEFAULT: 'var(--green)',
          bg: 'var(--green-bg)',
        },
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
      borderRadius: {
        'card': '18px',
      },
      boxShadow: {
        'fab': '0 4px 12px rgba(249, 115, 22, 0.3)',
      }
    },
  },
  plugins: [],
}
