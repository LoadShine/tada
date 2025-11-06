import React from 'react';
import * as LucideIcons from 'lucide-react';
import {twMerge} from 'tailwind-merge';
import {iconMap, IconName} from "@/components/ui/IconMap.ts";

interface IconProps extends Omit<LucideIcons.LucideProps, 'ref'> {
    name: IconName;
    size?: number | string;
    className?: string;
    strokeWidth?: number; // Allow overriding default stroke width
}

const IconComponent = React.memo(React.forwardRef<SVGSVGElement, IconProps>(
    ({name, size = 16, className, strokeWidth = 1, ...props}, ref) => { // Default strokeWidth 1px
        const LucideIcon = iconMap[name];

        if (!LucideIcon) {
            if (process.env.NODE_ENV === 'development') {
                console.warn(`Icon "${name}" not found in iconMap. Rendering fallback (HelpCircle).`);
            }
            const FallbackIcon = LucideIcons.HelpCircle;
            return (
                <FallbackIcon
                    ref={ref} size={size} strokeWidth={strokeWidth}
                    absoluteStrokeWidth={true} // Ensure thin lines render correctly
                    className={twMerge('inline-block flex-shrink-0 stroke-current text-error animate-pulse', className)}
                    {...props} />
            );
        }

        return (
            <LucideIcon
                ref={ref} size={size} strokeWidth={strokeWidth}
                absoluteStrokeWidth={true} // Ensure thin lines render correctly
                className={twMerge('inline-block flex-shrink-0 stroke-current', className)}
                {...props} />
        );
    }
));
IconComponent.displayName = 'Icon';
export default IconComponent;