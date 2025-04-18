// src/components/layout/IconBar.tsx
import React, {memo, useCallback} from 'react';
import { NavLink } from 'react-router-dom';
import Icon from '../common/Icon';
import { useAtom, useAtomValue } from 'jotai';
import { currentUserAtom, isSettingsOpenAtom } from '@/store/atoms';
import { motion } from 'framer-motion';
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

    const handleAvatarClick = useCallback(() => { // Use useCallback
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen]);

    const getNavLinkClass = useCallback(({ isActive }: { isActive: boolean }): string => // Use useCallback
        twMerge(
            'flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-150 ease-apple group relative',
            // Use glass effect for active/hover states
            isActive
                ? 'bg-primary/25 text-primary backdrop-blur-md ring-1 ring-inset ring-primary/30' // Active glass with ring
                : 'text-muted-foreground hover:bg-black/20 hover:text-gray-700 hover:backdrop-blur-sm' // Stronger hover glass
        ), []); // Empty dependency array

    return (
        // Apply stronger glassmorphism effect to the entire bar
        <div className="w-16 bg-glass-alt-100 backdrop-blur-xl border-r border-black/10 flex flex-col items-center py-4 flex-shrink-0 z-20 shadow-strong"> {/* Strongest blur, stronger shadow */}
            {/* App Logo Placeholder */}
            <div
                className="mb-6 mt-1 flex items-center justify-center w-9 h-9 bg-gradient-to-br from-primary/90 to-blue-500/80 rounded-lg text-white font-bold text-xl shadow-inner"
                aria-label="Tada App Logo"
            >
                <span className="-mt-0.5">T</span>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col items-center space-y-2 flex-1">
                {navigationItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={getNavLinkClass}
                        title={item.label}
                        aria-label={item.label}
                        end={item.path === '/all'} // Ensure 'All Tasks' is only active at exact path
                    >
                        {({ isActive }) => (
                            <motion.div
                                // Smoother spring animation for icon scale
                                animate={{ scale: isActive ? 1.15 : 1 }}
                                transition={{ type: 'spring', stiffness: 350, damping: 18, duration: 0.15 }}
                            >
                                <Icon name={item.icon} size={20} strokeWidth={1.75} />
                            </motion.div>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Avatar / Settings Trigger */}
            <div className="mt-auto mb-1">
                <Button
                    onClick={handleAvatarClick}
                    variant="glass" // Use glass variant for consistency
                    size="icon"
                    className="w-9 h-9 rounded-full overflow-hidden p-0 border border-black/10 shadow-inner hover:bg-black/15 backdrop-blur-md" // Added blur, consistent hover
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
                            {/* Show icon if no name */}
                            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : <Icon name="user" size={16} />}
                        </div>
                    )}
                </Button>
            </div>
        </div>
    );
};

export default memo(IconBar); // Memoize as it only depends on atoms