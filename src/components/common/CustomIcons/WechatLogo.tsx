// src/components/common/CustomIcons/WechatLogo.tsx
import React from 'react';
import { LucideProps } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const WechatLogo = React.forwardRef<SVGSVGElement, LucideProps>(
    ({ size = 24, className, ...props }, ref) => (
        <svg
            ref={ref}
            width={size}
            height={size}
            viewBox="0 0 1024 1024"
            className={twMerge("inline-block flex-shrink-0", className)}
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <path
                d="M512 0C229.2 0 0 193.2 0 432c0 151.6 82.4 282.8 205.6 358.8 2.4 1.2 4.4 2.4 6.8 3.6-22.8 42.4-54.4 78-91.6 102.8-1.2 0.8-2 2.4-2 3.6 0 2.4 2.4 4 4.8 4 68 0 128.8-22.4 178-63.6 24.8 4.4 50.4 7.2 76.4 7.2 282.8 0 512-193.2 512-432S794.8 0 512 0zm-152 488c-35.6 0-64.8-22.8-64.8-50.8s29.2-50.8 64.8-50.8c35.6 0 64.8 22.8 64.8 50.8s-29.2 50.8-64.8 50.8zm298.4 0c-35.6 0-64.8-22.8-64.8-50.8s29.2-50.8 64.8-50.8c35.6 0 64.8 22.8 64.8 50.8s-29.2 50.8-64.8 50.8z"
                fill="#09BB07"
            />
        </svg>
    )
);
WechatLogo.displayName = 'WechatLogo';
export default WechatLogo;