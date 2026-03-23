/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#F0F4FF',
        surface:    '#FFFFFF',
        card:       '#FFFFFF',
        border:     '#E2E8F4',
        sidebar: {
          DEFAULT: '#3D6EF5',
          hover:   '#2B5CE5',
          deep:    '#1E4FD8',
        },
        primary: {
          DEFAULT: '#3D6EF5',
          hover:   '#2B5CE5',
          light:   '#EEF2FF',
        },
        accent: {
          DEFAULT: '#10C9A0',
          hover:   '#0DB490',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger:  '#EF4444',
        text: {
          DEFAULT:   '#0F172A',
          muted:     '#64748B',
          secondary: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:  '0 1px 3px rgba(61,110,245,0.06), 0 4px 14px rgba(61,110,245,0.05)',
        float: '0 8px 24px rgba(0,0,0,0.10)',
        modal: '0 20px 60px rgba(0,0,0,0.15)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      backgroundImage: {
        'gradient-radial':   'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary':  'linear-gradient(135deg, #3D6EF5 0%, #10C9A0 100%)',
        'gradient-sidebar':  'linear-gradient(160deg, #3D6EF5 0%, #2B5CE5 100%)',
      },
    },
  },
  plugins: [],
}
