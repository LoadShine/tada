// src/components/common/Button.tsx
import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import Icon from './Icon';
import { motion, HTMLMotionProps } from 'framer-motion';
import { IconName } from "@/components/common/IconMap";

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger' | 'glass';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "size"> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: IconName;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
    loading?: boolean;
    children?: React.ReactNode;
    className?: string;
    'aria-label'?: string;
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
            'aria-label': ariaLabel,
            ...props
        },
        ref
    ) => {
        const isDisabled = disabled || loading;

        const baseClasses = clsx(
            'inline-flex items-center justify-center font-medium whitespace-nowrap select-none outline-none relative',
            'focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
            'transition-all duration-150 ease-apple', // Use consistent apple easing
            isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            fullWidth && 'w-full',
            'rounded-md' // Default rounding
        );

        const variantClasses: Record<ButtonVariant, string> = {
            primary: clsx(
                'bg-primary text-primary-foreground shadow-subtle border border-primary/90',
                !isDisabled && 'hover:bg-primary-dark active:bg-primary/95' // Slightly adjust active state
            ),
            secondary: clsx(
                // Enhanced glass effect for secondary
                'bg-glass-alt-100 text-gray-700 border border-black/10 shadow-subtle backdrop-blur-md',
                !isDisabled && 'hover:bg-glass-alt/80 active:bg-glass-alt/70'
            ),
            outline: clsx(
                // Enhanced glass effect for outline
                'border border-black/10 text-gray-700 bg-glass/50 backdrop-blur-sm shadow-subtle',
                !isDisabled && 'hover:bg-glass-alt/50 active:bg-glass-alt/60' // Subtle hover/active for glass
            ),
            ghost: clsx(
                'text-gray-600 border border-transparent', // Transparent border for consistent sizing
                // Slightly stronger hover/active for better visibility on glass backgrounds
                !isDisabled && 'hover:bg-black/15 hover:text-gray-800 active:bg-black/20'
            ),
            link: clsx(
                'text-primary underline-offset-4 h-auto px-0 py-0 rounded-none border-none bg-transparent shadow-none backdrop-filter-none', // Reset styles, remove blur
                !isDisabled && 'hover:underline hover:text-primary-dark'
            ),
            danger: clsx(
                'bg-red-500 text-white shadow-subtle border border-red-500/90',
                !isDisabled && 'hover:bg-red-600 active:bg-red-700'
            ),
            glass: clsx(
                'border border-black/10 text-gray-700 shadow-subtle', // Use subtle shadow
                // Choose appropriate glass background & blur
                'bg-glass-100 backdrop-blur-lg', // Use a more opaque glass and stronger blur
                !isDisabled && 'hover:bg-glass-alt-100 active:bg-glass-alt-200' // Transition between glass levels
            ),
        };

        const sizeClasses: Record<ButtonSize, string> = {
            sm: 'text-xs px-2.5 h-[30px]', // Slightly smaller padding for sm
            md: 'text-sm px-3 h-[32px]',
            lg: 'text-base px-3.5 h-[36px]',
            icon: 'h-8 w-8 p-0', // Standard icon button size
        };

        const iconSizeClasses: Record<ButtonSize, number> = {
            sm: 14,
            md: 16,
            lg: 18,
            icon: 18,
        };

        const getIconMargin = (pos: 'left' | 'right') => {
            // Provide margin ONLY if there are children AND it's not an icon-only button
            if (size === 'icon' || !children) return '';
            if (size === 'sm') return pos === 'left' ? 'mr-1' : 'ml-1';
            return pos === 'left' ? 'mr-1.5' : 'ml-1.5'; // md and lg
        };

        const motionProps = !isDisabled
            ? { whileTap: { scale: 0.97, transition: { duration: 0.08, ease: 'easeOut' } } } // Smoother tap animation
            : {};

        // Determine Aria Label: Explicitly provided > string child > fallback undefined
        // For icon-only buttons, aria-label is crucial.
        const finalAriaLabel = ariaLabel || (size === 'icon' ? undefined : (typeof children === 'string' ? children : undefined));
        if (size === 'icon' && !finalAriaLabel && !loading) {
            console.warn("Icon-only button is missing an 'aria-label' prop for accessibility.", { icon, children });
        }


        return (
            <motion.button
                ref={ref}
                type={type}
                className={twMerge(
                    baseClasses,
                    variant !== 'link' && sizeClasses[size], // Apply size unless link
                    variantClasses[variant],
                    className
                )}
                disabled={isDisabled}
                aria-label={finalAriaLabel}
                {...motionProps}
                {...props}
            >
                {loading ? (
                    <Icon name="loader" size={iconSizeClasses[size]} className="animate-spin" />
                ) : (
                    <>
                        {icon && iconPosition === 'left' && (
                            <Icon
                                name={icon}
                                size={iconSizeClasses[size]}
                                className={twMerge(getIconMargin('left'))}
                                aria-hidden="true"
                            />
                        )}
                        {/* Render children, visually hide if icon-only */}
                        <span className={clsx(size === 'icon' ? 'sr-only' : 'flex-shrink-0')}>{children}</span>
                        {icon && iconPosition === 'right' && (
                            <Icon
                                name={icon}
                                size={iconSizeClasses[size]}
                                className={twMerge(getIconMargin('right'))}
                                aria-hidden="true"
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