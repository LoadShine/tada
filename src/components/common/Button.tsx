// src/components/common/Button.tsx
import React from 'react';
import {twMerge} from 'tailwind-merge';
import {clsx} from 'clsx';
import Icon from './Icon';
import {IconName} from "@/components/common/IconMap";

type ButtonVariant = 'primary' | 'secondary' | 'link' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: IconName;
    iconPosition?: 'left' | 'right';
    iconProps?: Partial<React.ComponentProps<typeof Icon>>;
    fullWidth?: boolean;
    loading?: boolean;
    children?: React.ReactNode;
    className?: string;
    'aria-label'?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({
         children, variant = 'primary', size = 'md', icon, iconPosition = 'left', iconProps,
         className, fullWidth = false, loading = false, disabled, type = 'button',
         'aria-label': ariaLabel, ...props
     }, ref) => {
        const isDisabled = disabled || loading;

        const baseClasses = clsx(
            'inline-flex items-center justify-center font-normal whitespace-nowrap select-none outline-none relative',
            'focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-white',
            'transition-all duration-200 ease-in-out',
            isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            fullWidth && 'w-full',
            'rounded-base'
        );

        const variantClasses: Record<ButtonVariant, string> = {
            primary: clsx(
                'bg-primary text-white',
                !isDisabled && 'hover:bg-primary-dark'
            ),
            secondary: clsx(
                'bg-grey-ultra-light text-primary',
                !isDisabled && 'hover:bg-primary-light'
            ),
            link: clsx(
                'text-primary underline-offset-2 h-auto px-0 py-0 rounded-none shadow-none',
                !isDisabled && 'hover:text-primary-dark hover:underline'
            ),
            danger: clsx(
                'bg-error text-white',
                !isDisabled && 'hover:bg-error/80'
            ),
            ghost: clsx(
                'text-grey-medium border-transparent', // Default ghost icon color
                !isDisabled && 'hover:bg-grey-ultra-light hover:text-grey-dark' // Ghost icon hover text color
            ),
        };

        const sizeClasses: Record<ButtonSize, string> = {
            sm: 'text-[13px] px-3 h-8',
            md: 'text-[13px] px-4 h-8',
            lg: 'text-[14px] px-5 h-9',
            icon: 'p-0',
        };

        const iconButtonSizeClasses: Record<ButtonSize, string> = {
            sm: 'h-7 w-7',
            md: 'h-8 w-8',
            lg: 'h-9 w-9',
            icon: 'h-8 w-8',
        };


        const iconSizeMap: Record<ButtonSize, number> = {
            sm: 14, md: 16, lg: 18, icon: 16,
        };
        const finalIconSize = iconProps?.size ?? iconSizeMap[size];
        const finalIconStrokeWidth = iconProps?.strokeWidth ?? 1;
        const iconOpacityClass = iconProps?.className?.includes('opacity-') ? '' : 'opacity-90'; // Default icon opacity increased


        const getIconMargin = (pos: 'left' | 'right') => {
            if (size === 'icon' || !children) return '';
            return pos === 'left' ? 'mr-1.5' : 'ml-1.5';
        };

        const finalAriaLabel = ariaLabel || (size === 'icon' && !children ? undefined : (typeof children === 'string' ? children : undefined));
        if (size === 'icon' && !finalAriaLabel && !loading && !children && process.env.NODE_ENV === 'development') {
            console.warn(`Icon-only button without children is missing an 'aria-label'. Icon: ${icon || 'N/A'}`);
        }

        return (
            <button
                ref={ref} type={type}
                className={twMerge(baseClasses, size === 'icon' ? iconButtonSizeClasses[size] : sizeClasses[size], variantClasses[variant], className)}
                disabled={isDisabled} aria-label={finalAriaLabel} {...props} >
                {loading ? (
                    <Icon name="loader" size={finalIconSize} strokeWidth={finalIconStrokeWidth}
                          className={twMerge("animate-spin", iconOpacityClass)}/>
                ) : (
                    <>
                        {icon && iconPosition === 'left' && (
                            <Icon name={icon} size={finalIconSize} strokeWidth={finalIconStrokeWidth}
                                  className={twMerge(getIconMargin('left'), iconOpacityClass)} aria-hidden="true"/>)}
                        <span
                            className={clsx(size === 'icon' && !children && finalAriaLabel ? 'sr-only' : 'flex-shrink-0')}>{children}</span>
                        {icon && iconPosition === 'right' && (
                            <Icon name={icon} size={finalIconSize} strokeWidth={finalIconStrokeWidth}
                                  className={twMerge(getIconMargin('right'), iconOpacityClass)} aria-hidden="true"/>)}
                    </>
                )}
            </button>
        );
    }
);
Button.displayName = 'Button';
export default Button;