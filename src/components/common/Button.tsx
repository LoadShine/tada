// src/components/common/Button.tsx
import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import Icon, { IconName } from './Icon';
import { motion, HTMLMotionProps } from 'framer-motion';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "size" | "type"> { // Omit HTML type as well
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: IconName;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
    loading?: boolean;
    children?: React.ReactNode;
    type?: 'button' | 'submit' | 'reset'; // Explicitly define allowed button types
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
            'inline-flex items-center justify-center font-medium whitespace-nowrap select-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas', // Adjusted focus ring
            'transition-all duration-150 ease-apple', // Use custom easing
            isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
            fullWidth && 'w-full'
        );

        // Refined variant styles for better visual hierarchy and subtlety
        const variantClasses: Record<ButtonVariant, string> = {
            primary: clsx(
                'bg-primary text-white shadow-subtle', // Use subtle shadow
                !isDisabled && 'hover:bg-primary-dark hover:shadow-medium active:bg-primary-dark' // Add active state
            ),
            secondary: clsx(
                'bg-gray-100 text-gray-700 border border-gray-200/80 shadow-subtle', // Lighter border
                !isDisabled && 'hover:bg-gray-200 hover:border-gray-300 hover:shadow-medium active:bg-gray-200'
            ),
            outline: clsx(
                'border border-gray-300/90 text-gray-700 bg-canvas', // Slightly softer border
                !isDisabled && 'hover:bg-gray-100/60 hover:border-gray-400/90 active:bg-gray-100'
            ),
            ghost: clsx(
                'text-gray-700', // Default text color
                !isDisabled && 'hover:bg-gray-500/10 active:bg-gray-500/15' // More subtle hover/active
            ),
            link: clsx(
                'text-primary underline-offset-4 h-auto p-0', // Remove padding/height for link
                !isDisabled && 'hover:underline hover:text-primary-dark active:text-primary-dark'
            ),
            danger: clsx(
                'bg-red-600 text-white shadow-subtle', // Slightly darker red
                !isDisabled && 'hover:bg-red-700 hover:shadow-medium active:bg-red-700'
            ),
        };

        // Adjusted sizes and radii
        const sizeClasses: Record<ButtonSize, string> = {
            sm: 'text-xs px-2.5 h-7 rounded-md', // Smaller padding/height
            md: 'text-sm px-3.5 h-8 rounded-lg', // Adjusted large radius
            lg: 'text-sm px-4 h-9 rounded-lg', // Keep lg text sm, increase padding/height
            icon: 'h-8 w-8 rounded-lg', // Square icon button
        };

        // Icon sizes mapping
        const iconSizeClasses: Record<ButtonSize, number> = {
            sm: 14,
            md: 16,
            lg: 16, // Keep icon size 16 for lg
            icon: 18,
        };

        // Icon margin adjustments
        const iconMargin = size === 'icon' ? '' : (size === 'sm' ? 'mr-1' : 'mr-1.5');
        const iconMarginRight = size === 'icon' ? '' : (size === 'sm' ? 'ml-1' : 'ml-1.5');

        return (
            <motion.button
                ref={ref}
                type={type}
                className={twMerge(
                    baseClasses,
                    variant !== 'link' && sizeClasses[size], // Don't apply size classes to links
                    variantClasses[variant],
                    className
                )}
                disabled={isDisabled}
                // Subtle tap animation
                whileTap={!isDisabled ? { scale: 0.97, transition: { duration: 0.08 } } : {}}
                // Hover animation (optional, can be subtle scale or background transition handled by CSS)
                // whileHover={!isDisabled ? { scale: 1.03 } : {}}
                {...props}
            >
                {loading ? (
                    <Icon name="loader" size={iconSizeClasses[size]} className="animate-spin" />
                ) : (
                    <>
                        {icon && iconPosition === 'left' && (
                            <Icon name={icon} size={iconSizeClasses[size]} className={iconMargin} aria-hidden="true" />
                        )}
                        {/* Render children only if they exist */}
                        {children && <span className={size === 'icon' ? 'sr-only' : ''}>{children}</span>}
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