// tailwind.config.js
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Refined color palette - slightly adjusted primary
        'primary': {
          DEFAULT: 'hsl(208, 100%, 50%)', // Slightly less saturated blue, closer to Apple's
          'light': 'hsl(208, 100%, 96%)',
          'dark': 'hsl(208, 100%, 45%)',
        },
        'muted': {
          DEFAULT: 'hsl(210, 9%, 60%)', // Slightly lighter muted
          foreground: 'hsl(210, 10%, 40%)',
        },
        'canvas': { // Base background colors
          DEFAULT: 'hsl(0, 0%, 100%)', // Pure white as base
          alt: 'hsl(220, 25%, 97%)', // Slightly cooler, lighter alt background
          inset: 'hsl(220, 25%, 95%)', // Slightly cooler, lighter inset background
        },
        'border-color': { // Dedicated border color for subtlety
          DEFAULT: 'hsl(210, 20%, 90%)', // Subtle border
          medium: 'hsl(210, 15%, 85%)',
        },
        'glass': { // Adjusted alpha for more pronounced effect
          DEFAULT: 'hsla(0, 0%, 100%, 0.6)', // Base white glass
          alt: 'hsla(220, 25%, 97%, 0.7)', // Alt bg glass
          darker: 'hsla(220, 25%, 95%, 0.75)', // Inset bg glass
          sidebar: 'hsla(220, 25%, 97%, 0.8)', // Slightly more opaque for sidebar legibility
        }
      },
      borderRadius: {
        'sm': '0.25rem', // 4px
        'md': '0.375rem', // 6px - DEFAULT
        'lg': '0.5rem',  // 8px
        'xl': '0.75rem', // 12px
        'full': '9999px',
      },
      boxShadow: { // Slightly softer shadows
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 1px 0 rgba(0, 0, 0, 0.02)',
        'medium': '0 2px 4px -1px rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'strong': '0 6px 10px -3px rgba(0, 0, 0, 0.05), 0 3px 4px -4px rgba(0, 0, 0, 0.04)',
        'inner': 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.04)', // Subtle inner shadow
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.4, 0, 0.2, 1)', // Matches common ease-in-out
        'emphasized': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backdropBlur: { // More blur options
        'xs': '2px',
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'scale-out': {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.96)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(10px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out forwards',
        'fade-out': 'fade-out 0.15s ease-in forwards',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'scale-out': 'scale-out 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-up': 'slide-up 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-down': 'slide-down 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} satisfies Config;