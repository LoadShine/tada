// src/components/common/Icon.tsx
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { iconMap, IconName } from "@/components/common/IconMap"; // Ensure IconName is imported

// Use LucideProps for better type safety, excluding 'ref' as we handle it with forwardRef
interface IconProps extends Omit<LucideIcons.LucideProps, 'ref'> {
    name: IconName;
    size?: number | string;
    className?: string;
}

const Icon = React.forwardRef<SVGSVGElement, IconProps>(
    ({ name, size = 16, className, strokeWidth = 1.75, ...props }, ref) => {
        const IconComponent = iconMap[name];

        if (!IconComponent) {
            console.warn(`Icon "${name}" not found in iconMap. Rendering fallback.`);
            // Render a fallback icon (HelpCircle) and make it visually distinct (red)
            return (
                <LucideIcons.HelpCircle
                    ref={ref}
                    size={size}
                    strokeWidth={strokeWidth}
                    absoluteStrokeWidth={false}
                    className={twMerge(
                        'inline-block flex-shrink-0 stroke-current text-red-500 animate-pulse', // Add pulse for visibility
                        className
                    )}
                    {...props}
                />
            );
        }

        return (
            <IconComponent
                ref={ref}
                size={size}
                strokeWidth={strokeWidth}
                absoluteStrokeWidth={false} // Ensure stroke width scales with size unless overridden
                className={twMerge(
                    'inline-block flex-shrink-0 stroke-current', // Base classes: ensures inline behavior and uses parent text color
                    className // Allow overriding/extending classes
                )}
                {...props} // Pass remaining props (like onClick, etc.)
            />
        );
    }
);
Icon.displayName = 'Icon';
export default Icon;