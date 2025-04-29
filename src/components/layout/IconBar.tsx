// src/components/layout/IconBar.tsx
import React, { memo, useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Icon from '../common/Icon';
import { useAtom, useAtomValue } from 'jotai';
import { currentUserAtom, isSettingsOpenAtom } from '@/store/atoms';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconName } from "@/components/common/IconMap";

// Performance: Memoize IconBar
const IconBar: React.FC = memo(() => {
    const currentUser = useAtomValue(currentUserAtom);
    const [, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
    const location = useLocation(); // Get current location

    const navigationItems: { path: string; icon: IconName, label: string }[] = useMemo(() => [
        { path: '/all', icon: 'archive', label: 'All Tasks' },
        { path: '/calendar', icon: 'calendar-days', label: 'Calendar' },
        { path: '/summary', icon: 'sparkles', label: 'AI Summary' },
    ], []);

    const handleAvatarClick = useCallback(() => {
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen]);

    // Updated NavLink class logic
    const getNavLinkClass = useCallback((itemPath: string) => ({ isActive }: { isActive: boolean }): string => {
        let isEffectivelyActive = isActive;
        if (itemPath === '/all') {
            const isTaskListRelatedView = !location.pathname.startsWith('/calendar') && !location.pathname.startsWith('/summary');
            isEffectivelyActive = isTaskListRelatedView;
        }

        return cn(
            'flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 ease-in-out group relative',
            isEffectivelyActive
                ? 'bg-primary/15 text-primary scale-105 shadow-sm' // Subtle active emphasis
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:scale-105',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        );
    }, [location.pathname]);

    return (
        <div className="w-16 bg-glass-alt-100 backdrop-blur-xl border-r border-border/50 flex flex-col items-center py-4 flex-shrink-0 z-20 shadow-lg">
            {/* App Logo */}
            <div className="mb-6 mt-1 flex items-center justify-center w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-lg text-primary-foreground font-bold text-xl shadow-md select-none" aria-label="Tada App Logo" title="Tada">
                <span className="-mt-0.5">T</span>
            </div>

            {/* Main Navigation */}
            <nav className="flex flex-col items-center space-y-2 flex-1">
                {navigationItems.map((item) => (
                    <Tooltip key={item.path}>
                        <TooltipTrigger asChild>
                            <NavLink
                                to={item.path}
                                className={getNavLinkClass(item.path)}
                                aria-label={item.label}
                                // `end` prop ensures exact match for top-level routes like /calendar, /summary
                                end={item.path !== '/all'}
                            >
                                <Icon name={item.icon} size={20} strokeWidth={2} />
                            </NavLink>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                            <p>{item.label}</p>
                        </TooltipContent>
                    </Tooltip>
                ))}
            </nav>

            {/* User Avatar / Settings Trigger */}
            <div className="mt-auto mb-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            onClick={handleAvatarClick}
                            variant="ghost" size="icon"
                            className="w-9 h-9 rounded-full overflow-hidden p-0 border border-border/50 shadow-inner hover:ring-2 hover:ring-primary/50"
                            aria-label="Account Settings"
                        >
                            <Avatar className="h-full w-full">
                                <AvatarImage src={currentUser?.avatar} alt={currentUser?.name || 'User Avatar'} />
                                <AvatarFallback className="bg-muted text-muted-foreground font-medium text-sm">
                                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : <Icon name="user" size={16} />}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                        <p>Account Settings</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
});
IconBar.displayName = 'IconBar';
export default IconBar;