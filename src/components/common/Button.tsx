// src/components/common/Button.tsx
import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import Icon from './Icon'; // Correct import path
import { motion, HTMLMotionProps } from 'framer-motion';
import {IconName} from "@/components/common/IconMap.tsx";

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'; // Consistent sizes

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "size"> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: IconName; // Use the specific IconName type
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
            'aria-label': ariaLabel, // Destructure aria-label
            ...props
        },
        ref
    ) => {
        const isDisabled = disabled || loading;

        // Base styling - consistent radius, focus ring, transition
        const baseClasses = clsx(
            'inline-flex items-center justify-center font-medium whitespace-nowrap select-none outline-none relative', // Added relative for potential ::before/::after pseudo-elements
            'focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas', // Standard focus ring
            'transition-all duration-150 ease-apple', // Use standard Apple ease
            isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            fullWidth && 'w-full',
            'rounded-md' // Apply standard radius here
        );

        // Variant specific styles - Refined for subtlety
        const variantClasses: Record<ButtonVariant, string> = {
            primary: clsx(
                'bg-primary text-white shadow-subtle border border-primary/90', // Slightly softer border
                !isDisabled && 'hover:bg-primary-dark active:bg-primary' // Keep hover/active simple
            ),
            secondary: clsx(
                'bg-gray-100 text-gray-700 border border-border-color shadow-subtle',
                !isDisabled && 'hover:bg-gray-200 active:bg-gray-200'
            ),
            outline: clsx(
                'border border-border-color text-gray-700 bg-canvas', // Use canvas for pure outline
                !isDisabled && 'hover:bg-gray-100/50 active:bg-gray-100/70' // Subtle hover/active
            ),
            ghost: clsx(
                'text-gray-600 border border-transparent', // Use transparent border for layout consistency
                !isDisabled && 'hover:bg-black/5 active:bg-black/[0.07] hover:text-gray-800'
            ),
            link: clsx(
                'text-primary underline-offset-4 h-auto px-0 py-0 rounded-none border-none bg-transparent shadow-none', // Reset styles for link
                !isDisabled && 'hover:underline hover:text-primary-dark'
            ),
            danger: clsx(
                'bg-red-500 text-white shadow-subtle border border-red-500/90',
                !isDisabled && 'hover:bg-red-600 active:bg-red-700'
            ),
        };

        // Size specific styles
        const sizeClasses: Record<ButtonSize, string> = {
            sm: 'text-xs px-2.5 h-7',   // Standard small size
            md: 'text-sm px-3 h-8',     // Default medium size
            lg: 'text-base px-3.5 h-9', // Standard large size
            icon: 'h-8 w-8 p-0',        // Square icon button, padding removed for centering icon
        };

        // Icon size based on button size
        const iconSizeClasses: Record<ButtonSize, number> = {
            sm: 14,
            md: 16,
            lg: 18,
            icon: 18, // Standard icon size for icon-only buttons
        };

        // Icon margin logic - ensure correct spacing only when children exist
        const getIconMargin = (pos: 'left' | 'right') => {
            if (size === 'icon' || !children) return ''; // No margin if icon-only or no text content
            if (size === 'sm') return pos === 'left' ? 'mr-1' : 'ml-1';
            return pos === 'left' ? 'mr-1.5' : 'ml-1.5'; // md and lg
        };

        // Subtle animation props for non-disabled buttons
        const motionProps = !isDisabled
            ? {
                whileTap: { scale: 0.97, transition: { duration: 0.08 } },
                // Add subtle hover scale only if not 'ghost' or 'link' for cleaner interaction
                ...(!['ghost', 'link'].includes(variant)) && {
                    whileHover: { scale: 1.02, transition: { duration: 0.1 } },
                }
            }
            : {};

        // Determine Aria Label: Explicitly provided > string child > fallback undefined
        const finalAriaLabel = ariaLabel || (typeof children === 'string' ? children : undefined);

        return (
            <motion.button
                ref={ref}
                type={type}
                className={twMerge(
                    baseClasses,
                    variant !== 'link' && sizeClasses[size], // Apply size unless link
                    variantClasses[variant],
                    className // Allow overrides last
                )}
                disabled={isDisabled}
                aria-label={finalAriaLabel} // Apply the determined aria-label
                {...motionProps}
                {...props} // Spread remaining native button props
            >
                {loading ? (
                    // Ensure loading spinner uses an appropriate icon and size
                    <Icon name="loader" size={iconSizeClasses[size]} className="animate-spin" />
                ) : (
                    <>
                        {/* Render icon if 'icon' prop is provided and position is left */}
                        {icon && iconPosition === 'left' && (
                            <Icon
                                name={icon}
                                size={iconSizeClasses[size]}
                                className={twMerge(getIconMargin('left'))}
                                aria-hidden="true" // Hide decorative icon from screen readers
                            />
                        )}
                        {/* Render children, but hide visually if it's an icon-only button */}
                        {children && <span className={size === 'icon' ? 'sr-only' : ''}>{children}</span>}
                        {/* Render icon if 'icon' prop is provided and position is right */}
                        {icon && iconPosition === 'right' && (
                            <Icon
                                name={icon}
                                size={iconSizeClasses[size]}
                                className={twMerge(getIconMargin('right'))}
                                aria-hidden="true" // Hide decorative icon from screen readers
                            />
                        )}
                    </>
                )}
            </motion.button>
        );
    }
);
Button.displayName = 'Button';
export default Button;