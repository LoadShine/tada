// src/components/layout/IconBar.tsx
import React, {memo, useCallback, useMemo} from 'react';
import {NavLink, useLocation} from 'react-router-dom';
import Icon from '../common/Icon';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {currentUserAtom, isSettingsOpenAtom, settingsSelectedTabAtom} from '@/store/atoms';
import {twMerge} from 'tailwind-merge';
import Button from "@/components/common/Button";
import {IconName} from "@/components/common/IconMap";
import * as SortTooltip from '@radix-ui/react-tooltip';

const IconBar: React.FC = memo(() => {
    const currentUser = useAtomValue(currentUserAtom);
    const [, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
    const setSettingsTab = useSetAtom(settingsSelectedTabAtom);
    const location = useLocation();

    const navigationItems: { path: string; icon: IconName, label: string }[] = useMemo(() => [
        {path: '/all', icon: 'archive', label: 'All Tasks'},
        {path: '/calendar', icon: 'calendar-days', label: 'Calendar'},
        {path: '/summary', icon: 'sparkles', label: 'AI Summary'},
    ], []);

    const handleAvatarClick = useCallback(() => {
        setSettingsTab('account');
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen, setSettingsTab]);

    const getNavLinkClass = useCallback((itemPath: string): string => {
        let isSectionActive = false;
        const currentPath = location.pathname;
        if (itemPath === '/calendar') isSectionActive = currentPath.startsWith('/calendar');
        else if (itemPath === '/summary') isSectionActive = currentPath.startsWith('/summary');
        else if (itemPath === '/all') isSectionActive = !currentPath.startsWith('/calendar') && !currentPath.startsWith('/summary');

        return twMerge(
            'flex items-center justify-center w-10 h-10 rounded-base transition-colors duration-200 ease-in-out group relative',
            isSectionActive
                ? 'bg-grey-ultra-light text-primary dark:bg-primary-dark/20 dark:text-primary-light' // Adjusted active state for dark mode
                : 'text-grey-medium hover:bg-grey-ultra-light hover:text-grey-dark dark:text-neutral-400 dark:hover:bg-grey-deep dark:hover:text-neutral-100',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-grey-deep'
        );
    }, [location.pathname]);

    const tooltipContentClass = "text-[11px] bg-grey-dark text-white px-2 py-1 rounded-base shadow-md select-none z-[60] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut dark:bg-neutral-900 dark:text-neutral-100";

    return (
        <div
            className={twMerge(
                "w-16 flex flex-col items-center py-4 flex-shrink-0 z-20 border-r border-grey-light/50 dark:border-grey-deep/50",
                "bg-white/80 dark:bg-grey-deep/80 backdrop-blur-md transition-colors duration-300" // Semi-transparent with blur
            )}
        >
            <div
                className="mb-6 mt-1 flex items-center justify-center w-9 h-9 select-none" // Removed bg-primary, text-white, font-medium, text-xl, rounded-base (SVG is complex shape)
                aria-label="Tada App Logo" title="Tada">
                <svg
                    viewBox="0 0 509 811"
                    className="w-7 h-7 transition-colors duration-300" // Control size and theme color here
                    xmlns="http://www.w3.org/2000/svg"
                    fillRule="evenodd"
                >
                    <g id="tada" stroke="none" strokeWidth="1">
                        <path
                            d="M 194.5,660 C 194.5,743.118855 261.881145,810.5 345,810.5 C 392.548231,810.5 431.872984,771.391829 431.872984,723.149455 C 431.872984,680.808999 401.581557,645.504519 361.37491,637.5 C 290.715561,621.431263 229.356785,574.033996 194.5,509.5 L 194.5,660.5 Z"
                            id="rb"
                            className="text-primary/70 dark:text-primary-light/70"
                            fill="currentColor"/>
                        <path
                            d="M 194.5,132.5 L 419,132.5 C 322.114337,132.5 237.823932,186.426708 194.5,265.901836 L 194.5,132.5 Z"
                            className="text-primary-light dark:text-primary-light"
                            fill="currentColor"/>
                        <path
                            d="M 194.5,265.901836 L 194.5,320.5 L 414.5,320.5 C 466.414766,320.5 508.5,278.414766 508.5,226.5 C 508.5,174.585234 466.414766,132.5 414.5,132.5 L 419,132.5 C 322.114337,132.5 237.823932,186.426708 194.5,265.901836 Z"
                            className="text-primary/70 dark:text-primary-light/70"
                            fill="currentColor"/>
                        <path
                            d="M 0.5,90.5 C 0.5,40.7943725 40.7943725,0.5 90.5,0.5 C 140.205627,0.5 180.5,40.7943725 180.5,90.5 L 180.5,492.5 L 180.5,646.5 C 180.5,652.5 180.2,658.5 180.5,665 C 180.5,726.086765 215.894314,778.673183 268.182754,802.259064 C 116.79566,780.539233 0.5,650.35077 0.5,493 L 0.5,90.5 Z"
                            id="l"
                            className="text-primary-light dark:text-primary-light"
                            fill="currentColor"/>
                    </g>
                </svg>
            </div>

            <nav className="flex flex-col items-center space-y-2 flex-1">
                {navigationItems.map((item) => (
                    <SortTooltip.Root key={item.path} delayDuration={200}>
                        <SortTooltip.Trigger asChild>
                            <NavLink to={item.path} className={getNavLinkClass(item.path)} aria-label={item.label}>
                                <Icon name={item.icon} size={20} strokeWidth={1}/>
                            </NavLink>
                        </SortTooltip.Trigger>
                        <SortTooltip.Portal>
                            <SortTooltip.Content className={tooltipContentClass} side="right" sideOffset={6}>
                                {item.label}
                                <SortTooltip.Arrow className="fill-grey-dark dark:fill-neutral-900"/>
                            </SortTooltip.Content>
                        </SortTooltip.Portal>
                    </SortTooltip.Root>
                ))}
            </nav>

            <div className="mt-auto mb-1">
                <SortTooltip.Root delayDuration={200}>
                    <SortTooltip.Trigger asChild>
                        <Button onClick={handleAvatarClick} variant="ghost" size="icon"
                                className="w-9 h-9 rounded-full overflow-hidden p-0 hover:bg-grey-ultra-light dark:hover:bg-grey-deep focus-visible:ring-offset-white dark:focus-visible:ring-offset-grey-deep"
                                aria-label="Account Settings">
                            {currentUser?.avatarUrl ? (
                                <img src={currentUser.avatarUrl} alt={currentUser.username || 'User Avatar'}
                                     className="w-full h-full object-cover"/>
                            ) : (
                                <div
                                    className="w-full h-full bg-grey-light dark:bg-neutral-600 flex items-center justify-center text-grey-medium dark:text-neutral-300 font-normal text-sm">
                                    {currentUser?.username ? currentUser.username.charAt(0).toUpperCase() :
                                        <Icon name="user" size={16} strokeWidth={1}/>}
                                </div>
                            )}
                        </Button>
                    </SortTooltip.Trigger>
                    <SortTooltip.Portal>
                        <SortTooltip.Content className={tooltipContentClass} side="right" sideOffset={6}>
                            Account Settings
                            <SortTooltip.Arrow className="fill-grey-dark dark:fill-neutral-900"/>
                        </SortTooltip.Content>
                    </SortTooltip.Portal>
                </SortTooltip.Root>
            </div>
        </div>
    );
});
IconBar.displayName = 'IconBar';
export default IconBar;