import React, {Suspense, useMemo} from 'react';
import {Outlet, useLocation} from 'react-router-dom';
import IconBar from './IconBar';
import Sidebar from './Sidebar';
import SettingsModal from '../settings/SettingsModal';
import Icon from "@/components/ui/Icon.tsx";
import {twMerge} from 'tailwind-merge';
import {useAtomValue} from "jotai";
import {isZenFullScreenAtom} from "@/store/jotai.ts";
import useMediaQuery from "@/hooks/useMediaQuery";

/**
 * A loading spinner component displayed as a fallback for suspended content.
 */
const LoadingSpinner: React.FC = () => (
    <div
        className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-grey-deep/70 z-50 backdrop-blur-sm">
        <Icon name="loader" size={24} className="text-primary dark:text-primary-light animate-spin" strokeWidth={1.5}/>
    </div>
);
LoadingSpinner.displayName = 'LoadingSpinner';

/**
 * The main layout structure for the application.
 * It includes the primary navigation `IconBar`, the secondary `Sidebar`,
 * and the main content area which renders child routes via `<Outlet />`.
 */
const MainLayout: React.FC = () => {
    const location = useLocation();
    const isZenFullScreen = useAtomValue(isZenFullScreenAtom);
    const isWideLayout = useMediaQuery('(min-width: 768px)');

    // Determine if the sidebar should be hidden based on the current route.
    const hideSidebar = useMemo(() => {
        return ['/calendar', '/summary', '/zen', '/echo'].some(path => location.pathname.startsWith(path));
    }, [location.pathname]);
    const showSecondarySidebar = !hideSidebar && !isZenFullScreen && isWideLayout;

    return (
        <div
            className="flex h-screen bg-transparent overflow-hidden font-primary">
            {!isZenFullScreen && <IconBar/>}
            {showSecondarySidebar && (
                <div className={twMerge(
                    "w-[240px] flex-shrink-0 h-full relative border-r border-grey-light/50 dark:border-grey-deep/50",
                    "bg-white/50 dark:bg-grey-deep/50 backdrop-blur-md transition-colors duration-300"
                )}>
                    <Sidebar/>
                </div>
            )}
            <main className={twMerge(
                "flex-1 overflow-hidden relative flex flex-col min-w-0",
                "bg-white/50 dark:bg-grey-deep/50 backdrop-blur-md transition-colors duration-300"
            )}>
                <Suspense fallback={<LoadingSpinner/>}>
                    <Outlet/>
                </Suspense>
            </main>
            <SettingsModal/>
        </div>
    );
};
MainLayout.displayName = 'MainLayout';
export default MainLayout;
