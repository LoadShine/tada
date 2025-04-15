// src/components/layout/IconBar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import Icon, { IconName } from '../common/Icon';
import { useAtom } from 'jotai';
import { currentUserAtom, isSettingsOpenAtom } from '@/store/atoms';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

const IconBar: React.FC = () => {
    const [currentUser] = useAtom(currentUserAtom);
    const [, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);

    // Updated navigation items (All Tasks is now the primary/index)
    const navigationItems: { path: string; icon: IconName, label: string }[] = [
        { path: '/', icon: 'archive', label: 'All Tasks' }, // Index route
        { path: '/calendar', icon: 'calendar-days', label: 'Calendar' },
        { path: '/summary', icon: 'sparkles', label: 'AI Summary' }, // Changed icon
    ];

    const handleAvatarClick = () => {
        setIsSettingsOpen(true);
    };

    // Refined NavLink styling
    const getNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
        twMerge(
            'flex items-center justify-center w-11 h-11 rounded-lg transition-all duration-150 ease-apple group relative', // Slightly larger, ease-apple
            isActive
                ? 'bg-primary/10 text-primary' // Subtle active state
                : 'text-muted-foreground hover:bg-gray-500/10 hover:text-gray-800'
        );

    // Simple logo component
    const AppLogo = () => (
        <div className="mb-6 mt-1 flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary to-blue-400 rounded-lg text-white text-xl shadow-inner font-bold tracking-tighter">
            {/* Replace 'T' with a more abstract or refined logo/icon if available */}
            T
        </div>
    );

    return (
        // Apply glass effect and refine padding/shadow
        <div className="w-16 bg-glass/darker backdrop-blur-md border-r border-gray-200/60 flex flex-col items-center py-3 shadow-sm z-20 flex-shrink-0">
            <AppLogo />

            <nav className="flex flex-col items-center space-y-3 flex-1">
                {navigationItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={getNavLinkClass}
                        title={item.label} // Tooltip
                        end // Use end prop for exact matching on "/" for the 'All Tasks' route
                    >
                        {({ isActive }) => (
                            <>
                                <Icon name={item.icon} size={20} />
                                {/* Optional: Active indicator dot */}
                                {isActive && (
                                <motion.div
                                    layoutId="activeIconIndicator" // Animate indicator between items
                                    className="absolute -right-1 bottom-1 w-1.5 h-1.5 bg-primary rounded-full"
                                />
                            )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Avatar / Settings Trigger at the bottom */}
            <div className="mt-auto mb-1">
                <motion.button
                    onClick={handleAvatarClick}
                    className="w-9 h-9 rounded-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-alt" // Adjusted focus ring
                    whileHover={{ scale: 1.1, transition: { duration: 0.15 } }}
                    whileTap={{ scale: 0.95, transition: { duration: 0.1 } }}
                    title="Account Settings"
                >
                    {currentUser?.avatar ? (
                        <img
                            src={currentUser.avatar}
                            alt={currentUser.name || 'User Avatar'}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white font-medium text-sm">
                            {/* Initials */}
                            {currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                        </div>
                    )}
                </motion.button>
            </div>
        </div>
    );
};

export default IconBar;