// src/components/layout/MainLayout.tsx
import React, { Suspense, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import IconBar from './IconBar';
import Sidebar from './Sidebar';
import SettingsDialog from '../settings/SettingsDialog'; // Renamed from SettingsModal
import { useAtomValue } from 'jotai';
import { searchTermAtom } from '@/store/atoms';
import Icon from "@/components/common/Icon";
import { cn } from '@/lib/utils';

// Simple loading spinner component using shadcn/ui Icon
const LoadingSpinner: React.FC = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-50">
        <Icon name="loader" size={32} className="text-primary animate-spin" />
    </div>
);
LoadingSpinner.displayName = 'LoadingSpinner';

const MainLayout: React.FC = () => {
    const searchTerm = useAtomValue(searchTermAtom);
    const location = useLocation();

    const hideSidebar = useMemo(() => {
        const isSearching = searchTerm.trim().length > 0;
        return !isSearching && ['/calendar', '/summary'].some(path => location.pathname.startsWith(path));
    }, [searchTerm, location.pathname]);

    return (
        <div className="flex h-dvh bg-canvas overflow-hidden font-sans antialiased">
            {/* IconBar with fixed width */}
            <IconBar />

            {/* Conditional Sidebar rendering with fixed width */}
            {!hideSidebar && (
                <div className="w-60 flex-shrink-0 h-full relative bg-glass-alt-100 backdrop-blur-xl border-r border-border/50 shadow-md z-10">
                    <Sidebar />
                </div>
            )}

            {/* Main Content Area */}
            <main className={cn(
                "flex-1 overflow-hidden relative flex flex-col min-w-0",
                // Subtle background gradient or pattern can go here
                "bg-canvas" // Use canvas color for main area background
            )}>
                <Suspense fallback={<LoadingSpinner />}>
                    <Outlet /> {/* Renders the matched child route */}
                </Suspense>
            </main>

            {/* Settings Dialog - Controlled by Jotai state */}
            <SettingsDialog />
            {/* AddListDialog is rendered within Sidebar */}
        </div>
    );
};
MainLayout.displayName = 'MainLayout';
export default MainLayout;