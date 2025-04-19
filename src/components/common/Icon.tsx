// src/components/common/Icon.tsx
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { iconMap, IconName } from "@/components/common/IconMap";

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
            return (
                <LucideIcons.HelpCircle
                    ref={ref}
                    size={size}
                    strokeWidth={strokeWidth}
                    absoluteStrokeWidth={false}
                    className={twMerge(
                        'inline-block flex-shrink-0 stroke-current text-red-500 animate-pulse',
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
                absoluteStrokeWidth={false}
                className={twMerge(
                    'inline-block flex-shrink-0 stroke-current',
                    className
                )}
                {...props}
            />
        );
    }
);
Icon.displayName = 'Icon';
export default Icon;