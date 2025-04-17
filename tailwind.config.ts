// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Refined color palette - slightly adjusted primary
        'primary': {
          DEFAULT: 'hsl(208, 100%, 50%)', // Main blue
          'light': 'hsl(208, 100%, 96%)', // Very light blue for subtle backgrounds
          'dark': 'hsl(208, 100%, 45%)',  // Darker blue for hover/active
        },
        'muted': {
          DEFAULT: 'hsl(210, 9%, 65%)', // Standard muted color for placeholders, etc.
          foreground: 'hsl(210, 10%, 45%)', // Darker muted for secondary text
        },
        'canvas': { // Base background colors
          DEFAULT: 'hsl(0, 0%, 100%)',        // Pure white as base
          alt: 'hsl(220, 30%, 97.5%)',      // Slightly cooler, lighter alt background (e.g., Sidebar)
          inset: 'hsl(220, 30%, 96%)',      // Slightly cooler, lighter inset background (e.g., Inputs)
        },
        'border-color': { // Dedicated border color for subtlety
          DEFAULT: 'hsl(210, 20%, 90%)', // Subtle border
          medium: 'hsl(210, 15%, 85%)', // Medium border for inputs etc.
        },
        'glass': { // Glassmorphism colors - adjust alpha as needed
          // White with different alpha levels for layering
          '100': 'hsla(0, 0%, 100%, 0.8)',  // More opaque white glass (e.g., modals)
          '200': 'hsla(0, 0%, 100%, 0.7)',  // Standard white glass (e.g., headers)
          // Alt background color with alpha
          'alt-100': 'hsla(220, 30%, 97.5%, 0.85)', // More opaque alt glass (e.g., sidebar)
          'alt-200': 'hsla(220, 30%, 97.5%, 0.75)', // Standard alt glass
          // Darker inset background color with alpha
          'inset-100': 'hsla(220, 30%, 96%, 0.8)',
        }
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px',  // DEFAULT - Standardized small radius
        'lg': '8px',  // For modals, cards
        'xl': '12px', // Larger containers if needed
        'full': '9999px',
      },
      boxShadow: { // Slightly softer shadows
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 1px -1px rgba(0, 0, 0, 0.02)',
        'medium': '0 3px 5px -1px rgba(0, 0, 0, 0.04), 0 2px 3px -2px rgba(0, 0, 0, 0.03)', // Adjusted medium shadow
        'strong': '0 6px 10px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.04)', // Adjusted strong shadow
        'inner': 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.04)', // Subtle inner shadow
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.4, 0, 0.2, 1)', // Matches common ease-in-out used by Apple
        'emphasized': 'cubic-bezier(0.4, 0, 0.2, 1)', // Alias for clarity if needed
      },
      backdropBlur: { // More blur options
        'xs': '2px',
        'sm': '4px',
        'DEFAULT': '8px', // Standard blur
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
      },
      keyframes: { // Keep subtle animations
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-out': { '0%': { opacity: '1' }, '100%': { opacity: '0' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } }, // Slightly less scale
        'scale-out': { '0%': { opacity: '1', transform: 'scale(1)' }, '100%': { opacity: '0', transform: 'scale(0.97)' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } }, // Shorter distance
        'slide-down': { '0%': { opacity: '1', transform: 'translateY(0)' }, '100%': { opacity: '0', transform: 'translateY(8px)' } },
      },
      animation: { // Use shorter durations
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