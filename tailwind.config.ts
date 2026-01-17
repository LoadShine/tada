import type { Config } from 'tailwindcss';
import radixPlugin from 'tailwindcss-radix';
import typographyPlugin from '@tailwindcss/typography';
import formsPlugin from '@tailwindcss/forms';
import path from 'path';

export default {
    content: [
        path.join(__dirname, './packages/core/src/**/*.{js,ts,jsx,tsx}'),
        path.join(__dirname, './packages/web/src/**/*.{js,ts,jsx,tsx}'),
        path.join(__dirname, './packages/desktop/src/**/*.{js,ts,jsx,tsx}'),
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                'primary': 'hsl(var(--color-primary-hsl) / <alpha-value>)',
                'primary-light': 'hsl(var(--color-primary-light-hsl) / <alpha-value>)',
                'primary-dark': 'hsl(var(--color-primary-dark-hsl) / <alpha-value>)',
                'white': 'hsl(var(--color-white) / <alpha-value>)',
                'almost-white': 'hsl(var(--color-almost-white) / <alpha-value>)',
                'grey-ultra-light': 'hsl(var(--color-grey-ultra-light) / <alpha-value>)',
                'grey-light': 'hsl(var(--color-grey-light) / <alpha-value>)',
                'grey-medium': 'hsl(var(--color-grey-medium) / <alpha-value>)',
                'grey-dark': 'hsl(var(--color-grey-dark) / <alpha-value>)',
                'grey-deep': 'hsl(var(--color-grey-deep) / <alpha-value>)',
                'success': 'hsl(var(--color-success) / <alpha-value>)',
                'info': 'hsl(var(--color-info) / <alpha-value>)',
                'warning': 'hsl(var(--color-warning) / <alpha-value>)',
                'error': 'hsl(var(--color-error) / <alpha-value>)',
                'neutral-800': '#1D2530',
                'neutral-850': '#171E26',
                'neutral-750': '#222B38',
            },
            fontFamily: {
                primary: ['var(--font-primary)', 'sans-serif'],
            },
            fontWeight: {
                regular: 'var(--font-primary-regular-weight)',
                medium: 'var(--font-primary-medium-weight)',
                semibold: 'var(--font-primary-semibold-weight)',
            },
            borderRadius: {
                'sm': 'var(--border-radius-small)',
                'base': 'var(--border-radius-base)',
                'lg': 'var(--border-radius-large)',
                'full': 'var(--border-radius-full)',
                '4px': '4px',
            },
            boxShadow: {
                'interactive': 'var(--shadow-interactive)',
                'popover': 'var(--shadow-popover)',
                'modal': 'var(--shadow-modal)',
            },
            keyframes: {
                fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
                fadeOut: { from: { opacity: '1' }, to: { opacity: '0' } },
                modalShow: {
                    from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.98)' },
                    to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
                },
                modalHide: {
                    from: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
                    to: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.98)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                scaleOut: {
                    '0%': { opacity: '1', transform: 'scale(1)' },
                    '100%': { opacity: '0', transform: 'scale(0.95)' },
                },
                borderAnimation: {
                    '0%': { backgroundPosition: '0% 0%' },
                    '100%': { backgroundPosition: '300% 0%' },
                },
                aiShimmer: {
                    '0%': {
                        backgroundPosition: '-200% 0',
                    },
                    '100%': {
                        backgroundPosition: '200% 0',
                    },
                },
            },
            animation: {
                fadeIn: 'fadeIn 0.15s ease-out',
                fadeOut: 'fadeOut 0.15s ease-in',
                modalShow: 'modalShow 0.2s ease-out',
                modalHide: 'modalHide 0.2s ease-in',
                popoverShow: 'scaleIn 0.1s ease-out',
                popoverHide: 'scaleOut 0.1s ease-in',
                dropdownShow: 'scaleIn 0.1s ease-out',
                dropdownHide: 'scaleOut 0.1s ease-in',
                'border-flow': 'borderAnimation 4s linear infinite',
                'ai-shimmer': 'aiShimmer 1.5s ease-in-out infinite',
            },
        },
    },
    plugins: [
        radixPlugin({ variantPrefix: 'radix' }),
        typographyPlugin,
        formsPlugin({ strategy: 'class' }),
    ],
} satisfies Config;