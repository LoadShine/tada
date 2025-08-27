// src/components/common/CustomIcons/AlipayLogo.tsx
import React from 'react';
import { LucideProps } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const AlipayLogo = React.forwardRef<SVGSVGElement, LucideProps>(
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
                d="M768 512a256 256 0 1 0-512 0 256 256 0 0 0 512 0z"
                fill="#1677FF"
            />
            <path
                d="M632 400H389.6l-36.8 184h268.8a40 40 0 0 1 38.4 54.4l-20.8 72a40 40 0 0 1-54.4-38.4l11.2-40H372l-49.6 248h292.8a40 40 0 0 0 38.4-54.4l-52.8-240a40 40 0 0 0-38.4-25.6z"
                fill="#FFF"
            />
        </svg>
    )
);
AlipayLogo.displayName = 'AlipayLogo';
export default AlipayLogo;