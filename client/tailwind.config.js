/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary — vibrant indigo (works on light bg)
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Emerald — secondary / success
        emerald: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        // Coral / warm orange — highlight / energy
        coral: {
          50: '#fff7ed',
          100: '#ffedd5',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
        // Amber — warnings / marks
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Surface — LIGHT (key change from dark to light)
        surface: {
          0: '#ffffff',
          50: '#f8faff',   // page background — cool off-white
          100: '#f1f5f9',   // subtle section bg
          200: '#e2e8f0',   // dividers / borders
          300: '#cbd5e1',   // stronger borders
          800: '#1e293b',   // kept for dark text uses
          900: '#0f172a',
          950: '#020617',
        },
        // Accent — sky blue (used sparingly for info)
        accent: {
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        // Status
        success: '#10b981',
        warning: '#f59e0b',
        info: '#0ea5e9',
        muted: '#64748b',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.08)',
        'card-md': '0 2px 8px rgba(15,23,42,0.08), 0 8px 24px rgba(15,23,42,0.10)',
        'card-hover': '0 4px 16px rgba(79,70,229,0.12), 0 1px 4px rgba(15,23,42,0.06)',
        'glow-sm': '0 0 12px rgba(79,70,229,0.18)',
        'glow': '0 0 24px rgba(79,70,229,0.25)',
        'inner-sm': 'inset 0 1px 3px rgba(15,23,42,0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'bounce-in': 'bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { opacity: 0, transform: 'translateY(12px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        bounceIn: { '0%': { opacity: 0, transform: 'scale(0.92)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
