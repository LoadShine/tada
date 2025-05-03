// tailwind.config.ts
import type {Config} from 'tailwindcss';

const config: Config = {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    darkMode: 'class', // Optional: Add dark mode support if needed
    theme: {
        extend: {
            // Define Apple-like colors (adjust saturation/lightness as needed)
            colors: {
                // Primary accent color (e.g., Blue)
                primary: {
                    DEFAULT: 'hsl(210, 100%, 50%)', // Brighter blue
                    dark: 'hsl(210, 100%, 45%)', // Slightly darker for hover/active
                    foreground: 'hsl(0, 0%, 100%)', // White text on primary
                    // Define shades for states (optional but helpful)
                    // Use HSL for easier adjustments
                    '50': 'hsl(210, 100%, 97%)',
                    '100': 'hsl(210, 100%, 94%)',
                    '200': 'hsl(210, 100%, 88%)',
                    '300': 'hsl(210, 100%, 80%)',
                    '400': 'hsl(210, 100%, 65%)',
                    '500': 'hsl(210, 100%, 50%)', // DEFAULT
                    '600': 'hsl(210, 100%, 45%)', // dark
                    '700': 'hsl(210, 100%, 40%)',
                    '800': 'hsl(210, 100%, 35%)',
                    '900': 'hsl(210, 100%, 30%)',
                    '950': 'hsl(210, 100%, 20%)',
                },
                // Neutral grays (cool gray is often used by Apple)
                gray: {
                    '50': 'hsl(210, 20%, 98%)',
                    '100': 'hsl(210, 20%, 96%)',
                    '200': 'hsl(210, 16%, 93%)',
                    '300': 'hsl(210, 14%, 89%)',
                    '400': 'hsl(210, 12%, 80%)',
                    '500': 'hsl(210, 10%, 71%)', // Muted foreground often near here
                    '600': 'hsl(210, 8%, 56%)',
                    '700': 'hsl(210, 9%, 44%)', // Primary text often near here
                    '800': 'hsl(210, 10%, 30%)',
                    '900': 'hsl(210, 12%, 21%)',
                    '950': 'hsl(210, 15%, 15%)',
                },
                // Specific UI element colors
                canvas: { // General page background
                    DEFAULT: 'hsl(220, 30%, 98%)',
                    alt: 'hsl(220, 25%, 96%)',
                },
                muted: {
                    DEFAULT: 'hsl(210, 10%, 55%)', // Muted text, icons
                    foreground: 'hsl(210, 9%, 48%)', // Slightly darker muted text
                },
                // Glass effect backgrounds (use with backdrop-blur)
                glass: {
                    DEFAULT: 'hsla(0, 0%, 100%, 0.6)', // Base glass
                    '100': 'hsla(0, 0%, 100%, 0.75)', // Slightly more opaque
                    alt: { // Sidebar/alternate glass areas
                        '100': 'hsla(220, 30%, 97%, 0.8)',
                        '200': 'hsla(220, 30%, 97%, 0.6)',
                    },
                    inset: { // Input backgrounds
                        '100': 'hsla(210, 15%, 50%, 0.08)',
                        '200': 'hsla(210, 15%, 50%, 0.12)',
                    }
                },
                // Semantic colors
                danger: {
                    DEFAULT: 'hsl(0, 84%, 60%)',
                    foreground: 'hsl(0, 0%, 100%)',
                },
                warning: {
                    DEFAULT: 'hsl(45, 93%, 47%)',
                    foreground: 'hsl(45, 100%, 5%)',
                },
                success: {
                    DEFAULT: 'hsl(140, 75%, 40%)',
                    foreground: 'hsl(0, 0%, 100%)',
                },
                info: {
                    DEFAULT: 'hsl(190, 80%, 50%)',
                    foreground: 'hsl(0, 0%, 100%)',
                },

            },
            // Apple-like font stack
            fontFamily: {
                sans: [
                    '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"',
                    'Arial', '"Noto Sans"', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"',
                    '"Segoe UI Symbol"', '"Noto Color Emoji"',
                ],
                mono: [
                    'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"',
                    '"Courier New"', 'monospace',
                ],
            },
            // Subtle shadows
            boxShadow: {
                subtle: '0 1px 2px 0 hsla(0, 0%, 0%, 0.03), 0 1px 3px 0 hsla(0, 0%, 0%, 0.03)',
                medium: '0 4px 6px -1px hsla(0, 0%, 0%, 0.05), 0 2px 4px -2px hsla(0, 0%, 0%, 0.05)',
                strong: '0 10px 15px -3px hsla(0, 0%, 0%, 0.07), 0 4px 6px -4px hsla(0, 0%, 0%, 0.07)',
                inner: 'inset 0 1px 2px 0 hsla(0, 0%, 0%, 0.05)',
            },
            // Apple-like easing function (approximation)
            transitionTimingFunction: {
                'apple': 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',
                'apple-fast': 'cubic-bezier(0.32, 0.72, 0, 1)', // Faster variant
            },
            transitionDuration: {
                'apple': '350ms',
                'apple-fast': '200ms',
                'apple-micro': '150ms',
            },
            // Define keyframes for animations
            keyframes: {
                // Radix UI animations (fade, slide, scale)
                fadeIn: {'0%': {opacity: '0'}, '100%': {opacity: '1'}},
                fadeOut: {'0%': {opacity: '1'}, '100%': {opacity: '0'}},
                slideUpAndFade: {
                    '0%': {opacity: '0', transform: 'translateY(6px) scale(0.98)'},
                    '100%': {opacity: '1', transform: 'translateY(0) scale(1)'},
                },
                slideDownAndFade: {
                    '0%': {opacity: '1', transform: 'translateY(0) scale(1)'},
                    '100%': {opacity: '0', transform: 'translateY(6px) scale(0.98)'},
                },
                // Modal Content specific animation
                contentShow: {
                    '0%': {opacity: '0', transform: 'translate(-50%, -48%) scale(0.97)'},
                    '100%': {opacity: '1', transform: 'translate(-50%, -50%) scale(1)'},
                },
                contentHide: {
                    '0%': {opacity: '1', transform: 'translate(-50%, -50%) scale(1)'},
                    '100%': {opacity: '0', transform: 'translate(-50%, -48%) scale(0.97)'},
                },
            },
            // Define animation utilities using the keyframes
            animation: {
                // General purpose
                fadeIn: 'fadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1)', // Faster curve for fade-in
                fadeOut: 'fadeOut 150ms cubic-bezier(0.16, 1, 0.3, 1)',
                // Radix Dropdown/Popover/Tooltip Content
                slideUpAndFade: 'slideUpAndFade 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                slideDownAndFade: 'slideDownAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)',
                // Radix Dialog Content
                contentShow: 'contentShow 250ms cubic-bezier(0.16, 1, 0.3, 1)',
                contentHide: 'contentHide 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            },
        },
    },
    plugins: [
        require('tailwindcss-radix'), // Use the Radix plugin for data-* variants
        require('@tailwindcss/forms'), // Optional: if you need form reset styles
    ],
};

export default config;