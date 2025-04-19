// src/components/layout/IconBar.tsx
// Removed icon scale animation
import React, {memo, useCallback} from 'react';
import { NavLink } from 'react-router-dom';
import Icon from '../common/Icon';
import { useAtom, useAtomValue } from 'jotai';
import { currentUserAtom, isSettingsOpenAtom } from '@/store/atoms';
import { twMerge } from 'tailwind-merge';
import Button from "@/components/common/Button";
import { IconName } from "@/components/common/IconMap";

const IconBar: React.FC = () => {
    const currentUser = useAtomValue(currentUserAtom);
    const [, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);

    const navigationItems: { path: string; icon: IconName, label: string }[] = [
        { path: '/all', icon: 'archive', label: 'All Tasks' },
        { path: '/calendar', icon: 'calendar-days', label: 'Calendar' },
        { path: '/summary', icon: 'sparkles', label: 'AI Summary' },
    ];

    const handleAvatarClick = useCallback(() => {
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen]);

    const getNavLinkClass = useCallback(({ isActive }: { isActive: boolean }): string =>
        twMerge(
            'flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-150 ease-apple group relative',
            isActive
                ? 'bg-primary/25 text-primary backdrop-blur-md ring-1 ring-inset ring-primary/30'
                : 'text-muted-foreground hover:bg-black/20 hover:text-gray-700 hover:backdrop-blur-sm'
        ), []);

    return (
        <div className="w-16 bg-glass-alt-100 backdrop-blur-xl border-r border-black/10 flex flex-col items-center py-4 flex-shrink-0 z-20 shadow-strong">
            <div
                className="mb-6 mt-1 flex items-center justify-center w-9 h-9 bg-gradient-to-br from-primary/90 to-blue-500/80 rounded-lg text-white font-bold text-xl shadow-inner"
                aria-label="Tada App Logo"
            >
                <span className="-mt-0.5">T</span>
            </div>

            <nav className="flex flex-col items-center space-y-2 flex-1">
                {navigationItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={getNavLinkClass}
                        title={item.label}
                        aria-label={item.label}
                        end={item.path === '/all'}
                    >
                        {/* Removed motion.div for icon scale */}
                        <Icon name={item.icon} size={20} strokeWidth={1.75} />
                    </NavLink>
                ))}
            </nav>

            <div className="mt-auto mb-1">
                <Button
                    onClick={handleAvatarClick}
                    variant="glass"
                    size="icon"
                    className="w-9 h-9 rounded-full overflow-hidden p-0 border border-black/10 shadow-inner hover:bg-black/15 backdrop-blur-md"
                    aria-label="Account Settings"
                >
                    {currentUser?.avatar ? (
                        <img
                            src={currentUser.avatar}
                            alt={currentUser.name || 'User Avatar'}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white font-medium text-sm">
                            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : <Icon name="user" size={16} />}
                        </div>
                    )}
                </Button>
            </div>
        </div>
    );
};

export default memo(IconBar);