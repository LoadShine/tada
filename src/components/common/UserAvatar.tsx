// src/components/common/UserAvatar.tsx
import React, {useMemo} from 'react';
import {User} from '@/types';
import {twMerge} from 'tailwind-merge';
import {generateColorFromName} from '@/utils/colorUtils';
import Icon from './Icon';

interface UserAvatarProps {
    user: User | null | undefined;
    size: number;
    className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({user, size, className}) => {
    const avatarData = useMemo(() => {
        if (user?.avatarUrl) {
            return {
                type: 'image' as const,
                src: user.avatarUrl,
                alt: user.username || 'User Avatar',
            };
        }
        if (user?.username) {
            const initial = user.username.charAt(0).toUpperCase();
            const {gradient, textHsl} = generateColorFromName(user.username);
            return {
                type: 'initials' as const,
                initial: initial,
                gradient: gradient,
                textHsl: textHsl,
            };
        }
        return {type: 'icon' as const};
    }, [user]);

    const fontSize = size * 0.45;

    return (
        <div
            className={twMerge(
                "rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center select-none",
                className
            )}
            style={{width: size, height: size}}
        >
            {avatarData.type === 'image' && (
                <img src={avatarData.src} alt={avatarData.alt} className="w-full h-full object-cover"/>
            )}
            {avatarData.type === 'initials' && (
                <div
                    className="w-full h-full flex items-center justify-center font-medium animated-gradient-avatar"
                    style={{'--avatar-gradient': avatarData.gradient} as React.CSSProperties}
                >
                    <span style={{
                        color: `hsl(${avatarData.textHsl})`,
                        fontSize: `${fontSize}px`,
                    }}>
                        {avatarData.initial}
                    </span>
                </div>
            )}
            {avatarData.type === 'icon' && (
                <div
                    className="w-full h-full flex items-center justify-center bg-grey-light dark:bg-neutral-700">
                    <Icon
                        name="user"
                        size={size * 0.55}
                        strokeWidth={1.5}
                        className="text-grey-medium dark:text-neutral-400"
                    />
                </div>
            )}
        </div>
    );
};

export default React.memo(UserAvatar);