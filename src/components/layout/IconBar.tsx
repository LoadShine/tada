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

    const navigationItems: { path: string; icon: IconName, label: string }[] = [
        { path: '/all', icon: 'archive', label: 'All Tasks' },
        { path: '/calendar', icon: 'calendar-days', label: 'Calendar' },
        { path: '/summary', icon: 'sparkles', label: 'AI Summary' },
    ];

    const handleAvatarClick = () => {
        setIsSettingsOpen(true);
    };

    const getNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
        twMerge(
            'flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-150 ease-apple group relative', // Base style, use ease-apple
            isActive
                ? 'bg-primary/15 text-primary' // Slightly stronger active state
                : 'text-muted-foreground hover:bg-black/5 hover:text-gray-700' // Subtle hover
        );

    return (
        // Apply glassmorphism effect here - sidebar variant
        <div className="w-16 bg-glass-sidebar backdrop-blur-md border-r border-black/5 flex flex-col items-center py-4 flex-shrink-0 z-20 shadow-subtle">
            {/* App Logo Placeholder - Subtle Gradient */}
            <motion.div
                className="mb-6 mt-1 flex items-center justify-center w-9 h-9 bg-gradient-to-br from-primary/80 via-blue-500/80 to-purple-500/80 rounded-lg text-white font-bold text-lg shadow-inner"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
            >
                T {/* Placeholder Logo */}
            </motion.div>

            <nav className="flex flex-col items-center space-y-2 flex-1"> {/* Slightly reduced space */}
                {navigationItems.map((item, index) => (
                    <motion.div
                        key={item.path}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + index * 0.05, duration: 0.2, ease: 'easeOut' }}
                    >
                        <NavLink
                            to={item.path}
                            className={getNavLinkClass}
                            title={item.label}
                            end={item.path === '/all'} // Ensure 'all' is exact match if needed
                        >
                            {({ isActive }) => ( // Use function child for potential animation based on active state
                                <motion.div
                                    animate={{ scale: isActive ? 1.1 : 1 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                >
                                    <Icon name={item.icon} size={20} />
                                </motion.div>
                            )}
                        </NavLink>
                    </motion.div>
                ))}
            </nav>

            {/* Avatar / Settings Trigger */}
            <motion.div
                className="mt-auto mb-1"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.3, ease: 'easeOut' }}
            >
                <motion.button
                    onClick={handleAvatarClick}
                    className="w-8 h-8 rounded-full overflow-hidden focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas-alt"
                    whileHover={{ scale: 1.15, transition: { duration: 0.1 } }} // Slightly more hover scale
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
                        <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white font-medium text-xs">
                            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : '?'}
                        </div>
                    )}
                </motion.button>
            </motion.div>
        </div>
    );
};

export default IconBar;