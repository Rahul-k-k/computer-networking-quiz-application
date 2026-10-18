/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        body: ['Nunito', 'system-ui', 'sans-serif'],
      },
      // Neutral ramp is driven by CSS custom properties (space-separated R G B)
      // so it can invert for dark mode — see src/index.css. Components use these
      // as bg-slate-50 (surfaces), text-slate-900 (headings), etc.
      colors: {
        slate: {
          50: 'rgb(var(--c-slate-50) / <alpha-value>)',
          100: 'rgb(var(--c-slate-100) / <alpha-value>)',
          200: 'rgb(var(--c-slate-200) / <alpha-value>)',
          300: 'rgb(var(--c-slate-300) / <alpha-value>)',
          400: 'rgb(var(--c-slate-400) / <alpha-value>)',
          500: 'rgb(var(--c-slate-500) / <alpha-value>)',
          600: 'rgb(var(--c-slate-600) / <alpha-value>)',
          700: 'rgb(var(--c-slate-700) / <alpha-value>)',
          800: 'rgb(var(--c-slate-800) / <alpha-value>)',
          900: 'rgb(var(--c-slate-900) / <alpha-value>)',
          950: 'rgb(var(--c-slate-950) / <alpha-value>)',
        },
        // Static pastel accents (the chosen clay palette + supporting shades).
        grape: {
          100: '#EDE7FF', 200: '#D9CCFF', 300: '#C4B5FD', 400: '#A78BFA',
          500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9',
        },
        peach: {
          100: '#FFE9E5', 200: '#FFD6CF', 300: '#FDBCB4', 400: '#F79E93',
          500: '#EE7E6F', 600: '#DB5F4F', 700: '#B24537',
        },
        mint: {
          100: '#E9FFE9', 200: '#C7FFC7', 300: '#98FF98', 400: '#6EE86E',
          500: '#3FCB3F', 600: '#2BA82B', 700: '#1F831F',
        },
        sky: {
          100: '#EAF6FB', 200: '#CDEBF5', 300: '#ADD8E6', 400: '#7FC0D6',
          500: '#4FA3C0', 600: '#3583A0', 700: '#276379',
        },
      },
      borderRadius: {
        'clay-sm': '14px',
        clay: '20px',
        'clay-lg': '28px',
        'clay-xl': '36px',
      },
      // Puffy double shadows (outer depth + inner highlight). Driven by CSS
      // vars so they re-tune for dark mode.
      boxShadow: {
        clay: 'var(--clay)',
        'clay-sm': 'var(--clay-sm)',
        'clay-lg': 'var(--clay-lg)',
        'clay-inset': 'var(--clay-inset)',
        'clay-press': 'var(--clay-press)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
