// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Refined color palette
        'primary': {
          DEFAULT: 'hsl(208, 100%, 50%)', // Standard primary blue
          'light': 'hsl(208, 100%, 96%)', // Very light blue for subtle backgrounds
          'dark': 'hsl(208, 100%, 45%)',  // Darker blue for hover/active states
          'foreground': 'hsl(0, 0%, 100%)', // White for high contrast on primary blue
        },
        'muted': {
          DEFAULT: 'hsl(210, 9%, 80%)', // Lighter muted grey for borders/placeholders
          foreground: 'hsl(210, 10%, 60%)', // Darker muted grey text
        },
        'canvas': {
          DEFAULT: 'hsl(0, 0%, 100%)', // Pure white default background
          alt: 'hsl(220, 40%, 98%)', // Slightly off-white/blueish alt background
          inset: 'hsl(220, 30%, 96%)', // Slightly darker inset background
        },
        'border-color': { // Renamed for clarity
          DEFAULT: 'hsl(210, 25%, 93%)', // Default light border
          medium: 'hsl(210, 20%, 88%)', // Slightly darker border
          // Semi-transparent black/white for glass borders
          'glass-subtle': 'hsla(0, 0%, 0%, 0.08)',
          'glass-medium': 'hsla(0, 0%, 0%, 0.12)',
          'glass-light': 'hsla(0, 0%, 100%, 0.1)', // Subtle light border on dark glass
        },
        // --- Enhanced Glassmorphism Colors ---
        // Define multiple levels of glass opacity for different layers
        'glass': {
          // Base Canvas (White) Colors with Alpha
          'DEFAULT': 'hsla(0, 0%, 100%, 0.6)', // Default white glass (more transparent)
          '100': 'hsla(0, 0%, 100%, 0.8)',     // Opaque white glass
          '200': 'hsla(0, 0%, 100%, 0.7)',     // Medium white glass
          '300': 'hsla(0, 0%, 100%, 0.5)',     // Very transparent white glass

          // Alt Canvas (Off-White/Blueish) Colors with Alpha
          'alt': 'hsla(220, 40%, 98%, 0.6)',    // Default alt glass (more transparent)
          'alt-100': 'hsla(220, 40%, 98%, 0.8)', // Opaque alt glass
          'alt-200': 'hsla(220, 40%, 98%, 0.7)', // Medium alt glass
          'alt-300': 'hsla(220, 40%, 98%, 0.5)', // Very transparent alt glass

          // Inset Canvas (Slightly Darker) Colors with Alpha
          'inset': 'hsla(220, 30%, 96%, 0.7)',  // Default inset glass
          'inset-100': 'hsla(220, 30%, 96%, 0.8)', // Opaque inset glass
          'inset-200': 'hsla(220, 30%, 96%, 0.6)', // More transparent inset glass
        }
        // --- End Enhanced Glassmorphism Colors ---
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px', // Default
        'lg': '8px',
        'xl': '12px', // For modals/larger elements
        'full': '9999px',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 hsla(0, 0%, 0%, 0.05)',
        'medium': '0 4px 8px -2px hsla(0, 0%, 0%, 0.07), 0 2px 4px -2px hsla(0, 0%, 0%, 0.05)', // Slightly enhanced medium
        'strong': '0 10px 20px -5px hsla(0, 0%, 0%, 0.1), 0 4px 8px -4px hsla(0, 0%, 0%, 0.08)', // Enhanced strong shadow
        'inner': 'inset 0 1px 2px 0 hsla(0, 0%, 0%, 0.05)',
        'inner-strong': 'inset 0 2px 4px 0 hsla(0, 0%, 0%, 0.06)',
        // Shadows specifically for glass elements (using primary color tint)
        'glass': '0 4px 12px -2px hsla(208, 100%, 50%, 0.1), 0 2px 4px -2px hsla(208, 100%, 50%, 0.06)',
        'glass-lg': '0 8px 24px -6px hsla(208, 100%, 50%, 0.12), 0 4px 8px -4px hsla(208, 100%, 50%, 0.08)',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.4, 0, 0.2, 1)', // Standard smooth ease
        'emphasized': 'cubic-bezier(0.4, 0, 0.2, 1)', // Same as apple for now
        'sharp': 'cubic-bezier(0.4, 0, 0.6, 1)', // Faster in, slower out
        'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
      // Define a wider range of blur values
      backdropBlur: {
        'none': '0',
        'xs': '2px',
        'sm': '4px',
        'DEFAULT': '8px', // Default medium blur
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '32px', // Extra large blur option
        '3xl': '48px', // Max blur option
      },
      keyframes: { // Keep standard keyframes
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-out': { '0%': { opacity: '1' }, '100%': { opacity: '0' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'scale-out': { '0%': { opacity: '1', transform: 'scale(1)' }, '100%': { opacity: '0', transform: 'scale(0.97)' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-down': { '0%': { opacity: '1', transform: 'translateY(0)' }, '100%': { opacity: '0', transform: 'translateY(8px)' } },
        'slide-in-right': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        'slide-out-right': { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(100%)' } },
      },
      animation: { // Use consistent ease functions
        'fade-in': 'fade-in 0.18s ease-out forwards',
        'fade-out': 'fade-out 0.15s ease-in forwards',
        'scale-in': 'scale-in 0.18s ease-apple forwards',
        'scale-out': 'scale-out 0.15s ease-apple forwards',
        'slide-up': 'slide-up 0.18s ease-apple forwards',
        'slide-down': 'slide-down 0.15s ease-apple forwards',
        'slide-in-right': 'slide-in-right 0.25s ease-apple forwards',
        'slide-out-right': 'slide-out-right 0.22s ease-apple forwards',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'), // Keep forms plugin if needed
  ],
} satisfies Config;