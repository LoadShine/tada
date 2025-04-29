// src/components/ui/button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import Icon from "../common/Icon" // Use our Icon component
import { IconName } from "../common/IconMap"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm focus-visible:ring-1 focus-visible:ring-ring/80 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm focus-visible:ring-1 focus-visible:ring-destructive/80 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                outline:
                    "border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm focus-visible:ring-1 focus-visible:ring-ring/80 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm focus-visible:ring-1 focus-visible:ring-ring/80 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                ghost: "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:text-primary/80",
                // Custom glass variant
                glass: "border border-border/30 bg-glass-alt-100 backdrop-blur-lg text-foreground hover:bg-glass-alt-200 shadow-subtle focus-visible:ring-1 focus-visible:ring-ring/80 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            },
            size: {
                default: "h-9 px-4 py-2", // md size
                sm: "h-8 rounded-md px-3 text-xs",
                lg: "h-11 rounded-md px-8",
                icon: "h-9 w-9", // Adjusted icon size slightly
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean
    icon?: IconName
    iconPosition?: 'left' | 'right'
    loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, icon, iconPosition = 'left', loading = false, children, disabled, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        const isDisabled = disabled || loading;

        // Icon size styles based on button size
        const iconSizeMap: Record<NonNullable<ButtonProps['size']>, number> = {
            default: 16,
            sm: 14,
            lg: 18,
            icon: 18,
        };
        const iconSize = iconSizeMap[size ?? 'default'];

        // Icon margin helper
        const getIconMargin = (pos: 'left' | 'right') => {
            if (size === 'icon' || !children) return '';
            if (size === 'sm') return pos === 'left' ? 'mr-1' : 'ml-1';
            return pos === 'left' ? 'mr-1.5' : 'ml-1.5';
        };

        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={isDisabled}
                {...props}
            >
                {loading ? (
                    <Icon name="loader" size={iconSize} className="animate-spin" />
                ) : (
                    <>
                        {icon && iconPosition === 'left' && (
                            <Icon
                                name={icon}
                                size={iconSize}
                                className={cn(getIconMargin('left'), "flex-shrink-0")}
                                aria-hidden="true"
                            />
                        )}
                        {children}
                        {icon && iconPosition === 'right' && (
                            <Icon
                                name={icon}
                                size={iconSize}
                                className={cn(getIconMargin('right'), "flex-shrink-0")}
                                aria-hidden="true"
                            />
                        )}
                    </>
                )}
            </Comp>
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }