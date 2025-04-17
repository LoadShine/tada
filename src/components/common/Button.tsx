// src/components/common/Button.tsx
import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import Icon, { IconName } from './Icon';
import { motion, HTMLMotionProps } from 'framer-motion';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "size"> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: IconName;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
    loading?: boolean;
    children?: React.ReactNode;
    className?: string; // Allow className override
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            children,
            variant = 'primary',
            size = 'md',
            icon,
            iconPosition = 'left',
            className,
            fullWidth = false,
            loading = false,
            disabled,
            type = 'button',
            ...props
        },
        ref
    ) => {
        const isDisabled = disabled || loading;

        const baseClasses = clsx(
            'inline-flex items-center justify-center font-medium whitespace-nowrap select-none outline-none', // Remove focus outline, handled by focus-visible
            'focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas', // Adjusted focus ring
            'transition-all duration-150 ease-in-out', // Standard transition
            isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer', // Reduced opacity for disabled
            fullWidth && 'w-full'
        );

        // Use consistent 'rounded-md' for most buttons, 'rounded-lg' for larger ones maybe? Let's stick to md.
        const commonRadius = 'rounded-md';

        const variantClasses: Record<ButtonVariant, string> = {
            primary: clsx(
                'bg-primary text-white shadow-subtle',
                !isDisabled && 'hover:bg-primary-dark hover:shadow-medium active:bg-primary'
            ),
            secondary: clsx(
                'bg-gray-100 text-gray-700 border border-gray-200/80 shadow-subtle',
                !isDisabled && 'hover:bg-gray-200 hover:border-gray-300 active:bg-gray-200'
            ),
            outline: clsx(
                'border border-gray-300/80 text-gray-700 bg-canvas', // Use canvas for pure outline
                !isDisabled && 'hover:bg-gray-100/50 hover:border-gray-400/80 active:bg-gray-100'
            ),
            ghost: clsx(
                'text-gray-600', // Slightly lighter text for ghost
                !isDisabled && 'hover:bg-gray-500/10 active:bg-gray-500/15 hover:text-gray-800'
            ),
            link: clsx(
                'text-primary underline-offset-4 h-auto px-0 py-0', // Reset padding/height for link
                !isDisabled && 'hover:underline hover:text-primary-dark'
            ),
            danger: clsx(
                'bg-red-500 text-white shadow-subtle',
                !isDisabled && 'hover:bg-red-600 active:bg-red-700'
            ),
        };

        const sizeClasses: Record<ButtonSize, string> = {
            sm: `text-xs px-2.5 h-7 ${commonRadius}`, // Smaller height/padding
            md: `text-sm px-3 h-8 ${commonRadius}`, // Default size
            lg: `text-base px-4 h-9 ${commonRadius}`, // Larger size
            icon: `h-8 w-8 ${commonRadius}`, // Square icon button matching md height
        };

        const iconSizeClasses: Record<ButtonSize, number> = {
            sm: 14,
            md: 16,
            lg: 18,
            icon: 18, // Consistent icon size for icon button
        };

        const iconMargin = size === 'icon' || !children ? '' : size === 'sm' ? 'mr-1' : 'mr-1.5';
        const iconMarginRight = size === 'icon' || !children ? '' : size === 'sm' ? 'ml-1' : 'ml-1.5';

        const motionProps = !isDisabled
            ? { whileTap: { scale: 0.97, transition: { duration: 0.05 } } }
            : {};

        return (
            <motion.button
                ref={ref}
                type={type}
                className={twMerge(
                    baseClasses,
                    variant !== 'link' && sizeClasses[size], // Don't apply size classes to link variant
                    variant !== 'link' && variantClasses[variant], // Don't apply background/border to link
                    variant === 'link' && variantClasses.link, // Apply only link styles if variant is link
                    className // Allow overrides
                )}
                disabled={isDisabled}
                {...motionProps}
                {...props}
            >
                {loading ? (
                    <Icon name="loader" size={iconSizeClasses[size]} className="animate-spin" />
                ) : (
                    <>
                        {icon && iconPosition === 'left' && (
                            <Icon name={icon} size={iconSizeClasses[size]} className={iconMargin} aria-hidden="true" />
                        )}
                        {/* Ensure children are rendered correctly even for icon buttons (for accessibility) */}
                        {children && <span className={size === 'icon' && children ? 'sr-only' : ''}>{children}</span>}
                        {icon && iconPosition === 'right' && (
                            <Icon name={icon} size={iconSizeClasses[size]} className={iconMarginRight} aria-hidden="true" />
                        )}
                    </>
                )}
            </motion.button>
        );
    }
);
Button.displayName = 'Button';
export default Button;