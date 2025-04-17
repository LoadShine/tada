// src/components/common/Button.tsx
import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import Icon, { IconName } from './Icon'; // Correct import path assuming Icon.tsx is in the same directory
import { motion, HTMLMotionProps } from 'framer-motion';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'; // Consistent sizes

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "size"> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: IconName;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
    loading?: boolean;
    children?: React.ReactNode;
    className?: string; // Allow className override
    'aria-label'?: string; // Ensure aria-label is accepted
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

        // Base styling - consistent radius, focus ring
        const baseClasses = clsx(
            'inline-flex items-center justify-center font-medium whitespace-nowrap select-none outline-none',
            'focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas', // Adjusted focus ring
            'transition-all duration-150 ease-apple', // Use apple timing function
            isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            fullWidth && 'w-full',
            'rounded-md' // Apply default radius here
        );

        // Variant specific styles
        const variantClasses: Record<ButtonVariant, string> = {
            primary: clsx(
                'bg-primary text-white shadow-subtle border border-primary', // Add border for definition
                !isDisabled && 'hover:bg-primary-dark hover:border-primary-dark active:bg-primary active:border-primary'
            ),
            secondary: clsx(
                'bg-gray-100 text-gray-700 border border-border-color shadow-subtle',
                !isDisabled && 'hover:bg-gray-200 hover:border-border-color-medium active:bg-gray-200'
            ),
            outline: clsx(
                'border border-border-color text-gray-700 bg-canvas', // Use canvas for pure outline
                !isDisabled && 'hover:bg-gray-100/50 hover:border-border-color-medium active:bg-gray-100'
            ),
            ghost: clsx(
                'text-gray-600 border border-transparent', // Use transparent border for layout consistency
                !isDisabled && 'hover:bg-black/5 active:bg-black/[0.07] hover:text-gray-800'
            ),
            link: clsx(
                'text-primary underline-offset-4 h-auto px-0 py-0 rounded-none border-none', // Reset styles for link
                !isDisabled && 'hover:underline hover:text-primary-dark'
            ),
            danger: clsx(
                'bg-red-500 text-white shadow-subtle border border-red-500',
                !isDisabled && 'hover:bg-red-600 hover:border-red-600 active:bg-red-700 active:border-red-700'
            ),
        };

        // Size specific styles
        const sizeClasses: Record<ButtonSize, string> = {
            sm: 'text-xs px-2.5 h-7', // Slightly smaller height/padding
            md: 'text-sm px-3 h-8', // Default size
            lg: 'text-base px-3.5 h-9', // Larger size
            icon: 'h-8 w-8 p-0', // Square icon button, remove padding for icon centering
        };

        // Icon size based on button size
        const iconSizeClasses: Record<ButtonSize, number> = {
            sm: 14,
            md: 16,
            lg: 18,
            icon: 18, // Consistent icon size for icon button
        };

        // Icon margin logic - FIX: Ensure correct spacing
        const getIconMargin = (pos: 'left' | 'right') => {
            if (size === 'icon' || !children) return ''; // No margin if icon-only or no text
            if (size === 'sm') return pos === 'left' ? 'mr-1' : 'ml-1';
            return pos === 'left' ? 'mr-1.5' : 'ml-1.5'; // md and lg
        };

        // Animation props
        const motionProps = !isDisabled
            ? {
                whileTap: { scale: 0.97, transition: { duration: 0.08 } },
                whileHover: { scale: 1.02, transition: { duration: 0.1 } }, // Subtle hover scale
            }
            : {};

        return (
            <motion.button
                ref={ref}
                type={type}
                className={twMerge(
                    baseClasses,
                    variant !== 'link' && sizeClasses[size],
                    variantClasses[variant],
                    className // Allow overrides
                )}
                disabled={isDisabled}
                aria-label={props['aria-label'] || (typeof children === 'string' ? children : undefined)} // Auto add aria-label from children if not provided
                {...motionProps}
                {...props} // Spread remaining props
            >
                {loading ? (
                    <Icon name="loader" size={iconSizeClasses[size]} className="animate-spin" />
                ) : (
                    <>
                        {icon && iconPosition === 'left' && (
                            <Icon name={icon} size={iconSizeClasses[size]} className={twMerge(getIconMargin('left'))} aria-hidden="true" />
                        )}
                        {/* Render children correctly, hide visually for icon-only buttons */}
                        {children && <span className={size === 'icon' ? 'sr-only' : ''}>{children}</span>}
                        {icon && iconPosition === 'right' && (
                            <Icon name={icon} size={iconSizeClasses[size]} className={twMerge(getIconMargin('right'))} aria-hidden="true" />
                        )}
                    </>
                )}
            </motion.button>
        );
    }
);
Button.displayName = 'Button';
export default Button;