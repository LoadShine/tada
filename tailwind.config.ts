import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Refined Blue - slightly less saturated
        'primary': {
          DEFAULT: 'hsl(212, 88%, 55%)', // Slightly adjusted blue
          'light': 'hsl(212, 90%, 95%)',
          'dark': 'hsl(212, 88%, 48%)',
        },
        'muted': {
          DEFAULT: 'hsl(210, 10%, 65%)', // Slightly lighter default muted
          foreground: 'hsl(210, 10%, 45%)', // Slightly darker foreground muted
        },
        'canvas': { // Base background colors
          DEFAULT: 'hsl(0, 0%, 100%)', // White
          alt: 'hsl(220, 20%, 97.5%)', // Very light cool gray
          inset: 'hsl(220, 20%, 96%)',  // Slightly darker inset
        },
        'glass': { // For blurred backgrounds
          DEFAULT: 'hsla(0, 0%, 100%, 0.7)', // More subtle glass
          darker: 'hsla(220, 20%, 97.5%, 0.8)', // For alt background
        }
      },
      borderRadius: {
        'md': '0.375rem', // Standard medium
        'lg': '0.625rem', // Slightly less large radius
        'xl': '0.875rem', // Slightly less xl radius
      },
      boxShadow: {
        // More subtle shadows inspired by Apple's HIG
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 1px 3px 0 rgba(0, 0, 0, 0.03)',
        'medium': '0 3px 5px -1px rgba(0, 0, 0, 0.05), 0 2px 3px -2px rgba(0, 0, 0, 0.04)',
        'strong': '0 8px 12px -3px rgba(0, 0, 0, 0.07), 0 3px 5px -4px rgba(0, 0, 0, 0.05)',
        'inner-sm': 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.4, 0.0, 0.2, 1)', // Similar to ease-in-out, common in iOS/macOS
        'emphasized': 'cubic-bezier(0.4, 0, 0.2, 1)', // Standard material ease
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '5px', // Standard small blur
        'DEFAULT': '10px', // Default blur
        'md': '15px', // Medium blur
        'lg': '20px',
        'xl': '30px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-out-down': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(10px)' },
        }
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out forwards',
        'slide-in-up': 'slide-in-up 0.2s cubic-bezier(0.4, 0.0, 0.2, 1) forwards',
        'slide-out-down': 'slide-out-down 0.15s cubic-bezier(0.4, 0.0, 0.2, 1) forwards',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class', // Opt-in strategy for form styles
    }),
  ],
} satisfies Config;