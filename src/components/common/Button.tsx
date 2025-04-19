// src/components/common/Button.tsx
// Removed framer-motion and tap animation
import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import Icon from './Icon';
import { IconName } from "@/components/common/IconMap";

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger' | 'glass';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

// Use React.ButtonHTMLAttributes for standard button props
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
            ...props // Spread remaining standard button attributes
        },
        ref
    ) => {
        const isDisabled = disabled || loading;

        const baseClasses = clsx(
            'inline-flex items-center justify-center font-medium whitespace-nowrap select-none outline-none relative',
            'focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
            'transition-colors duration-150 ease-apple', // Keep color transition
            isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            fullWidth && 'w-full',
            'rounded-md'
        );

        const variantClasses: Record<ButtonVariant, string> = {
            primary: clsx(
                'bg-primary text-primary-foreground shadow-subtle border border-primary/90',
                !isDisabled && 'hover:bg-primary-dark active:bg-primary/95'
            ),
            secondary: clsx(
                'bg-glass-alt-100 text-gray-700 border border-black/10 shadow-subtle backdrop-blur-md',
                !isDisabled && 'hover:bg-glass-alt/80 active:bg-glass-alt/70'
            ),
            outline: clsx(
                'border border-black/10 text-gray-700 bg-glass/50 backdrop-blur-sm shadow-subtle',
                !isDisabled && 'hover:bg-glass-alt/50 active:bg-glass-alt/60'
            ),
            ghost: clsx(
                'text-gray-600 border border-transparent',
                !isDisabled && 'hover:bg-black/15 hover:text-gray-800 active:bg-black/20'
            ),
            link: clsx(
                'text-primary underline-offset-4 h-auto px-0 py-0 rounded-none border-none bg-transparent shadow-none backdrop-filter-none',
                !isDisabled && 'hover:underline hover:text-primary-dark'
            ),
            danger: clsx(
                'bg-red-500 text-white shadow-subtle border border-red-500/90',
                !isDisabled && 'hover:bg-red-600 active:bg-red-700'
            ),
            glass: clsx(
                'border border-black/10 text-gray-700 shadow-subtle',
                'bg-glass-100 backdrop-blur-lg',
                !isDisabled && 'hover:bg-glass-alt-100 active:bg-glass-alt-200'
            ),
        };

        const sizeClasses: Record<ButtonSize, string> = {
            sm: 'text-xs px-2.5 h-[30px]',
            md: 'text-sm px-3 h-[32px]',
            lg: 'text-base px-3.5 h-[36px]',
            icon: 'h-8 w-8 p-0',
        };

        const iconSizeClasses: Record<ButtonSize, number> = {
            sm: 14,
            md: 16,
            lg: 18,
            icon: 18,
        };

        const getIconMargin = (pos: 'left' | 'right') => {
            if (size === 'icon' || !children) return '';
            if (size === 'sm') return pos === 'left' ? 'mr-1' : 'ml-1';
            return pos === 'left' ? 'mr-1.5' : 'ml-1.5';
        };

        // Removed motionProps

        const finalAriaLabel = ariaLabel || (size === 'icon' ? undefined : (typeof children === 'string' ? children : undefined));
        if (size === 'icon' && !finalAriaLabel && !loading) {
            console.warn("Icon-only button is missing an 'aria-label' prop for accessibility.", { icon, children });
        }

        return (
            <button
                ref={ref}
                type={type}
                className={twMerge(
                    baseClasses,
                    variant !== 'link' && sizeClasses[size],
                    variantClasses[variant],
                    className
                )}
                disabled={isDisabled}
                aria-label={finalAriaLabel}
                {...props} // Pass standard button props
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
            </button>
        );
    }
);
Button.displayName = 'Button';
export default Button;