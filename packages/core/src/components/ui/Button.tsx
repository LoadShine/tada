import React from 'react';
import {twMerge} from 'tailwind-merge';
import {clsx} from 'clsx';
import Icon from './Icon';
import {IconName} from "@/components/ui/IconMap.ts";

type ButtonVariant = 'primary' | 'secondary' | 'link' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

// Define a specific type for the 'type' prop when 'as' is 'button' or undefined
type ButtonType = "button" | "submit" | "reset";

interface AsButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
    as?: 'button';
    href?: never;
    type?: ButtonType; // Use the more specific ButtonType here
}

interface AsLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    as: 'a';
    href: string;
    disabled?: boolean;
    type?: never; // Links don't have a 'type' attribute in the same way buttons do
}

export type ButtonProps = (AsButtonProps | AsLinkProps) & {
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
};

const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
    ({
         as = 'button', children, variant = 'primary', size = 'md', icon, iconPosition = 'left', iconProps,
         className, fullWidth = false, loading = false, disabled,
         'aria-label': ariaLabel, ...props
     }, ref) => {
        const isDisabled = disabled || loading;

        const baseClasses = clsx(
            'inline-flex items-center justify-center font-normal whitespace-nowrap select-none outline-none relative',
            'focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-grey-deep',
            'transition-all duration-200 ease-in-out',
            isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            fullWidth && 'w-full',
            'rounded-base'
        );

        const variantClasses: Record<ButtonVariant, string> = {
            primary: clsx(
                'bg-primary text-white dark:bg-primary-light dark:text-grey-deep',
                !isDisabled && 'hover:bg-primary-dark dark:hover:bg-primary'
            ),
            secondary: clsx(
                'bg-grey-ultra-light text-primary dark:bg-neutral-700 dark:text-primary-light',
                !isDisabled && 'hover:bg-primary-light/70 dark:hover:bg-neutral-600'
            ),
            link: clsx(
                'text-primary dark:text-primary-light underline-offset-2 h-auto px-0 py-0 rounded-none shadow-none',
                !isDisabled && 'hover:text-primary-dark dark:hover:text-primary hover:underline'
            ),
            danger: clsx(
                'bg-error text-white dark:bg-error/80 dark:text-white',
                !isDisabled && 'hover:bg-error/70 dark:hover:bg-error/70'
            ),
            ghost: clsx(
                'text-grey-medium dark:text-neutral-400 border-transparent',
                !isDisabled && 'hover:bg-grey-ultra-light dark:hover:bg-neutral-700 hover:text-grey-dark dark:hover:text-neutral-200'
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
        const iconOpacityClass = iconProps?.className?.includes('opacity-') ? '' : 'opacity-90';

        const getIconMargin = (pos: 'left' | 'right') => {
            if (size === 'icon' || !children) return '';
            return pos === 'left' ? 'mr-1.5' : 'ml-1.5';
        };

        const finalClassName = twMerge(baseClasses, size === 'icon' ? iconButtonSizeClasses[size] : sizeClasses[size], variantClasses[variant], className);

        const finalAriaLabel = ariaLabel || (size === 'icon' && !children ? undefined : (typeof children === 'string' ? children : undefined));
        if (size === 'icon' && !finalAriaLabel && !loading && !children && process.env.NODE_ENV === 'development') {
            // console.warn(`Icon-only button without children is missing an 'aria-label'. Icon: ${icon || 'N/A'}`);
        }

        const content = (
            <>
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
            </>
        );

        if (as === 'a') {
            const {type, ...linkProps} = props as AsLinkProps; // Destructure out type for anchor
            return (
                <a
                    ref={ref as React.Ref<HTMLAnchorElement>}
                    className={finalClassName}
                    aria-disabled={isDisabled ? 'true' : undefined}
                    aria-label={finalAriaLabel}
                    {...linkProps}
                    onClick={isDisabled ? (e) => e.preventDefault() : linkProps.onClick}
                >
                    {content}
                </a>
            );
        }

        const {type = 'button', ...buttonProps} = props as AsButtonProps; // Default type to 'button'
        return (
            <button
                ref={ref as React.Ref<HTMLButtonElement>}
                type={type} // Use the destructured type with default
                className={finalClassName}
                disabled={isDisabled}
                aria-label={finalAriaLabel}
                {...buttonProps}
            >
                {content}
            </button>
        );
    }
);
Button.displayName = 'Button';
export default Button;