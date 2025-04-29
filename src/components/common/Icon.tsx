// src/components/common/Icon.tsx
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { iconMap, IconName } from "./IconMap"; // Keep using local IconMap
import { cn } from '@/lib/utils';

// Extend LucideProps, but omit 'ref' as it's handled by forwardRef
interface IconProps extends Omit<LucideIcons.LucideProps, 'ref'> {
    name: IconName;
    size?: number | string;
    className?: string;
}

// Performance: Use React.memo as Icons are pure components based on props
const IconComponent = React.memo(React.forwardRef<SVGSVGElement, IconProps>(
    ({ name, size = 16, className, strokeWidth = 1.75, ...props }, ref) => {
        const LucideIcon = iconMap[name];

        // Fallback for missing icons
        if (!LucideIcon) {
            if (process.env.NODE_ENV === 'development') {
                console.warn(`Icon "${name}" not found in iconMap. Rendering fallback (HelpCircle).`);
            }
            const FallbackIcon = LucideIcons.HelpCircle;
            return (
                <FallbackIcon
                    ref={ref}
                    size={size}
                    strokeWidth={strokeWidth}
                    absoluteStrokeWidth={typeof strokeWidth === 'number' && strokeWidth > 3}
                    className={cn(
                        'inline-block flex-shrink-0 stroke-current text-destructive animate-pulse', // Use theme color
                        className
                    )}
                    {...props}
                />
            );
        }

        // Render the requested icon
        return (
            <LucideIcon
                ref={ref}
                size={size}
                strokeWidth={strokeWidth}
                absoluteStrokeWidth={typeof strokeWidth === 'number' && strokeWidth > 3}
                className={cn(
                    'inline-block flex-shrink-0 stroke-current', // Base styling
                    className
                )}
                {...props}
            />
        );
    }
));
IconComponent.displayName = 'Icon';
export default IconComponent;