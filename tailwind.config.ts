// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary': {
          DEFAULT: 'hsl(208, 100%, 50%)',
          'light': 'hsl(208, 100%, 96%)',
          'dark': 'hsl(208, 100%, 45%)',
          'foreground': 'hsl(0, 0%, 100%)',
        },
        'muted': {
          DEFAULT: 'hsl(210, 9%, 80%)',
          foreground: 'hsl(210, 10%, 60%)',
        },
        'canvas': {
          DEFAULT: 'hsl(0, 0%, 100%)',
          alt: 'hsl(220, 40%, 98%)',
          inset: 'hsl(220, 30%, 96%)',
        },
        'border-color': {
          DEFAULT: 'hsl(210, 25%, 93%)',
          medium: 'hsl(210, 20%, 88%)',
          'glass-subtle': 'hsla(0, 0%, 0%, 0.08)',
          'glass-medium': 'hsla(0, 0%, 0%, 0.12)',
          'glass-light': 'hsla(0, 0%, 100%, 0.1)',
        },
        'glass': {
          'DEFAULT': 'hsla(0, 0%, 100%, 0.6)',
          '100': 'hsla(0, 0%, 100%, 0.8)',
          '200': 'hsla(0, 0%, 100%, 0.7)',
          '300': 'hsla(0, 0%, 100%, 0.5)',
          'alt': 'hsla(220, 40%, 98%, 0.6)',
          'alt-100': 'hsla(220, 40%, 98%, 0.8)',
          'alt-200': 'hsla(220, 40%, 98%, 0.7)',
          'alt-300': 'hsla(220, 40%, 98%, 0.5)',
          'inset': 'hsla(220, 30%, 96%, 0.7)',
          'inset-100': 'hsla(220, 30%, 96%, 0.8)',
          'inset-200': 'hsla(220, 30%, 96%, 0.6)',
        }
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
        'full': '9999px',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 hsla(0, 0%, 0%, 0.05)',
        'medium': '0 4px 8px -2px hsla(0, 0%, 0%, 0.07), 0 2px 4px -2px hsla(0, 0%, 0%, 0.05)',
        'strong': '0 10px 20px -5px hsla(0, 0%, 0%, 0.1), 0 4px 8px -4px hsla(0, 0%, 0%, 0.08)',
        'inner': 'inset 0 1px 2px 0 hsla(0, 0%, 0%, 0.05)',
        'inner-strong': 'inset 0 2px 4px 0 hsla(0, 0%, 0%, 0.06)',
        'glass': '0 4px 12px -2px hsla(208, 100%, 50%, 0.1), 0 2px 4px -2px hsla(208, 100%, 50%, 0.06)',
        'glass-lg': '0 8px 24px -6px hsla(208, 100%, 50%, 0.12), 0 4px 8px -4px hsla(208, 100%, 50%, 0.08)',
        // Added specific shadow for date picker to match screenshot
        'xl': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'emphasized': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'sharp': 'cubic-bezier(0.4, 0, 0.6, 1)',
        'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
      backdropBlur: {
        'none': '0',
        'xs': '2px',
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '32px',
        '3xl': '48px',
      },
      // Removed unused animation definitions
      keyframes: {
        'spin': {
          'to': { transform: 'rotate(360deg)' },
        },
        // Removed fade, scale, slide keyframes
      },
      animation: {
        'spin': 'spin 1s linear infinite', // Keep spin for loaders
        // Removed other animation utilities
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} satisfies Config;