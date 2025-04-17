// src/components/common/Icon.tsx
import React from 'react';
import * as LucideIcons from 'lucide-react';
import {twMerge} from 'tailwind-merge';
import {iconMap} from "@/components/common/IconMap.tsx";

export type IconName = keyof typeof iconMap; // Dynamically generate type from map keys

interface IconProps extends Omit<LucideIcons.LucideProps, 'ref'> { // Use LucideProps for better type safety
    name: IconName;
    size?: number | string;
    className?: string;
}

const Icon = React.forwardRef<SVGSVGElement, IconProps>(
    ({ name, size = 16, className, strokeWidth = 1.75, ...props }, ref) => { // Default size 16, strokeWidth 1.75
        const IconComponent = iconMap[name];

        if (!IconComponent) {
            console.warn(`Icon "${name}" not found.`);
            // Render a fallback or nothing
            return <LucideIcons.HelpCircle ref={ref} size={size} className={twMerge('inline-block flex-shrink-0 stroke-current text-red-500', className)} {...props} />;
        }

        return (
            <IconComponent
                ref={ref}
                size={size}
                strokeWidth={strokeWidth}
                absoluteStrokeWidth={false} // Ensure stroke width scales with size
                className={twMerge('inline-block flex-shrink-0 stroke-current', className)} // Base classes
                {...props}
            />
        );
    }
);
Icon.displayName = 'Icon';
export default Icon;