// src/components/layout/MainLayout.tsx
// Removed sidebar animation and modal animation
import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import IconBar from './IconBar';
import Sidebar from './Sidebar';
import SettingsModal from '../settings/SettingsModal';
import { useAtomValue } from 'jotai';
import { isSettingsOpenAtom, searchTermAtom } from '@/store/atoms';
import Icon from "@/components/common/Icon";
import { twMerge } from 'tailwind-merge';

// Loading Spinner remains the same
const LoadingSpinner: React.FC = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-glass/70 backdrop-blur-md z-50">
        <Icon name="loader" size={32} className="text-primary animate-spin" />
    </div>
);

const MainLayout: React.FC = () => {
    const isSettingsOpen = useAtomValue(isSettingsOpenAtom);
    const searchTerm = useAtomValue(searchTermAtom);
    const location = useLocation();

    const hideSidebar = !searchTerm && ['/calendar', '/summary'].some(path => location.pathname.startsWith(path));

    return (
        <div className="flex h-screen bg-canvas-alt overflow-hidden">
            <IconBar />

            {/* Removed motion.div and AnimatePresence for Sidebar */}
            {!hideSidebar && (
                <div className="w-56 flex-shrink-0 h-full relative"> {/* Use fixed width */}
                    <Sidebar />
                </div>
            )}

            <main className={twMerge(
                "flex-1 overflow-hidden relative flex flex-col min-w-0",
                "bg-glass/30 backdrop-blur-lg"
            )}>
                <Suspense fallback={<LoadingSpinner />}>
                    <Outlet />
                </Suspense>
            </main>

            {/* Removed AnimatePresence for Modals */}
            {/* Modals will now appear/disappear instantly based on their internal logic or state */}
            {isSettingsOpen && <SettingsModal key="settings-modal" />}
            {/* Add other potential modals here */}
        </div>
    );
};

export default MainLayout;