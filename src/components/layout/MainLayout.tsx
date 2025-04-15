// src/components/layout/MainLayout.tsx
import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import IconBar from './IconBar';
import Sidebar from './Sidebar';
import SettingsModal from '../settings/SettingsModal';
import { useAtom } from 'jotai';
import { isSettingsOpenAtom } from '@/store/atoms';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from "@/components/common/Icon.tsx";

// Simple loading spinner component - Refined
const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center h-full w-full bg-canvas">
        <Icon name="loader" size={28} className="text-primary animate-spin" />
    </div>
);

const MainLayout: React.FC = () => {
    const [isSettingsOpen] = useAtom(isSettingsOpenAtom);
    const location = useLocation();

    // Determine if sidebar should be shown based on route
    const showSidebar = !location.pathname.startsWith('/calendar') && !location.pathname.startsWith('/summary');

    return (
        // Ensure outer div takes full screen height
        <div className="flex h-screen max-h-screen bg-canvas overflow-hidden">
            <IconBar />
            {/* Conditionally render Sidebar with transition */}
            <AnimatePresence>
                {showSidebar && (
                    <motion.div
                        initial={{ width: 0, opacity: 0, marginRight: '-1px' }} // Start collapsed, negative margin avoids border jump
                        animate={{ width: 240, opacity: 1, marginRight: 0 }} // Animate to 240px width (w-60)
                        exit={{ width: 0, opacity: 0, marginRight: '-1px', transition: { duration: 0.2 } }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="flex-shrink-0 overflow-hidden" // Prevent content overflow during animation
                    >
                        <Sidebar />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main content area should flex-grow and handle overflow */}
            <main className="flex-1 overflow-hidden relative flex flex-col min-w-0">
                {/* Outlet renders the current page */}
                <Suspense fallback={<LoadingSpinner />}>
                    <Outlet />
                </Suspense>
            </main>

            {/* Animated Settings Modal */}
            <AnimatePresence>
                {isSettingsOpen && <SettingsModal />}
            </AnimatePresence>
        </div>
    );
};

export default MainLayout;